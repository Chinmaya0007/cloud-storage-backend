import { Request, Response } from 'express';
import { supabase } from '../config/supabase';
import path from "path";
import fs from "fs";

/** LIST items in a folder */
export const listItems = async (req: Request, res: Response) => {
    try {
        const { folderId = null, ownerId } = req.query as {
            folderId?: string | null;
            ownerId: string;
        };
        console.log('📥 listItems called with:', { folderId, ownerId });

        // --- Folders query ---
        let folderQuery = supabase.from('folders').select('*').eq('owner_id', ownerId);

        if (folderId) {
            folderQuery = folderQuery.eq('parent_id', folderId);
        } else {
            folderQuery = folderQuery.is('parent_id', null);
        }

        const { data: folders, error: folderErr } = await folderQuery;
        console.log('📂 Supabase folders result:', folders, folderErr);

        // --- Files query ---
        let fileQuery = supabase.from('files').select('*').eq('owner_id', ownerId);

        if (folderId) {
            fileQuery = fileQuery.eq('folder_id', folderId);
        } else {
            fileQuery = fileQuery.is('folder_id', null);
        }

        const { data: files, error: fileErr } = await fileQuery;
        console.log('📄 Supabase files result:', files, fileErr);

        res.json({ folders: folders ?? [], files: files ?? [] });
    } catch (e: any) {
        console.error('❌ listItems error:', e);
        res.status(500).json({ message: e.message || 'Server error' });
    }
};

/** CREATE folder */
export const createFolder = async (req: Request, res: Response) => {
    try {
        let { name, parentId, ownerId } = req.body;

        if (!name || !ownerId) {
            return res.status(400).json({ message: 'name and ownerId are required' });
        }
        if (!parentId || parentId === '') parentId = null;

        const { data, error } = await supabase
            .from('folders')
            .insert([{ name, parent_id: parentId, owner_id: ownerId }])
            .select('*')
            .single();

        if (error) {
            console.error('❌ Supabase insert error:', error);
            return res.status(500).json({ message: error.message });
        }

        if (!data) {
            return res.status(500).json({ message: 'Failed to create folder' });
        }

        res.status(201).json(data);
    } catch (e: any) {
        console.error('❌ Server error in createFolder:', e);
        res.status(500).json({ message: e.message || 'Server error' });
    }
};

/** UPLOAD file metadata */
export const saveFileMeta = async (req: Request, res: Response) => {
    try {
        const { name, folderId = null, ownerId, src } = req.body;
        if (!name || !ownerId || !src) {
            return res.status(400).json({ message: 'name, ownerId and src are required' });
        }

        const { data, error } = await supabase
            .from('files')
            .insert([{ name, folder_id: folderId, owner_id: ownerId, src }])
            .select()
            .single();

        if (error) return res.status(400).json({ message: error.message });
        res.status(201).json(data);
    } catch (e: any) {
        res.status(500).json({ message: e.message || 'Server error' });
    }
};

/** DELETE file (from storage + DB) */
export const deleteFile = async (req: Request, res: Response) => {
    try {
        const { fileId, ownerId, src } = req.body;
        if (!fileId || !ownerId || !src) {
            return res.status(400).json({ message: 'fileId, ownerId and src are required' });
        }

        // remove from storage
        const { error: storageErr } = await supabase.storage.from('user-files').remove([src]);
        if (storageErr) return res.status(400).json({ message: storageErr.message });

        // remove from DB
        const { error: dbErr } = await supabase.from('files').delete().eq('id', fileId).eq('owner_id', ownerId);
        if (dbErr) return res.status(400).json({ message: dbErr.message });

        res.json({ message: 'File deleted successfully' });
    } catch (e: any) {
        res.status(500).json({ message: e.message || 'Server error' });
    }
};

/** RENAME folder */
export const renameFolder = async (req: Request, res: Response) => {
    try {
        const { folderId, newName, ownerId } = req.body;
        if (!folderId || !newName || !ownerId) {
            return res.status(400).json({ message: 'folderId, newName and ownerId are required' });
        }

        const { data, error } = await supabase
            .from('folders')
            .update({ name: newName })
            .eq('id', folderId)
            .eq('owner_id', ownerId)
            .select()
            .single();

        if (error) return res.status(400).json({ message: error.message });
        res.json(data);
    } catch (e: any) {
        res.status(500).json({ message: e.message || 'Server error' });
    }
};

/** DELETE folder (and its sub-items) */
export const deleteFolder = async (req: Request, res: Response) => {
    try {
        const { folderId, ownerId } = req.body;
        if (!folderId || !ownerId) {
            return res.status(400).json({ message: 'folderId and ownerId are required' });
        }

        // 1. delete files inside this folder
        const { data: files, error: filesErr } = await supabase
            .from('files')
            .select('*')
            .eq('folder_id', folderId)
            .eq('owner_id', ownerId);

        if (filesErr) return res.status(400).json({ message: filesErr.message });

        if (files && files.length > 0) {
            const paths = files.map((f) => f.src);
            await supabase.storage.from('user-files').remove(paths);
            await supabase
                .from('files')
                .delete()
                .in(
                    'id',
                    files.map((f) => f.id)
                );
        }

        // 2. delete subfolders (simple version, not recursive)
        await supabase.from('folders').delete().eq('parent_id', folderId);

        // 3. delete the folder itself
        const { error: folderErr } = await supabase.from('folders').delete().eq('id', folderId).eq('owner_id', ownerId);

        if (folderErr) return res.status(400).json({ message: folderErr.message });

        res.json({ message: 'Folder deleted successfully' });
    } catch (e: any) {
        res.status(500).json({ message: e.message || 'Server error' });
    }
};

export const uploadFile = (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const { ownerId, folderId } = req.body;

    // Ensure uploads dir exists
    const uploadDir = path.join(process.cwd(), "uploads");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir);
    }

    // Save file to disk
    const fileName = Date.now() + "-" + req.file.originalname;
    const filePath = path.join(uploadDir, fileName);
    fs.writeFileSync(filePath, req.file.buffer);

    // Public URL for frontend
    const fileUrl = `/uploads/${fileName}`;

    // 🔑 Return exactly what FileContext.tsx expects
    res.json({
      name: req.file.originalname,
      src: fileUrl,
      ownerId,
      folderId,
    });
  } catch (err) {
    console.error("❌ Upload error:", err);
    res.status(500).json({ error: "Server error while uploading" });
  }
};