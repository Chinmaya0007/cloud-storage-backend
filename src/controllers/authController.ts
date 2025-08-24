import { Request, Response } from "express";
import { supabase } from "../config/supabase";

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ message: "Email and password are required" });
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      res.status(400).json({ message: error.message });
      return;
    }

    // Check if confirmation email was sent
    if (!data.session) {
      res.status(200).json({
        id: data.user?.id,
        email: data.user?.email,
        message: "Confirmation email sent. Please check your inbox.",
      });
      return;
    }

    res.status(201).json({
      id: data.user?.id,
      email: data.user?.email,
      message: "User registered successfully",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({
        success: false,
        error: "VALIDATION_ERROR",
        message: "Email and password are required",
      });
      return;
    }

    // Supabase sign in
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      res.status(401).json({
        success: false,
        error: "AUTHENTICATION_FAILED",
        message: error.message || "Invalid email or password",
        details: error, // optional, helps debug
      });
      return;
    }

    if (!data?.user) {
      res.status(500).json({
        success: false,
        error: "USER_NOT_FOUND",
        message: "User login failed, no user data returned",
      });
      return;
    }

    res.status(200).json({
      success: true,
      id: data.user.id,
      email: data.user.email,
      access_token: data.session?.access_token,
      refresh_token: data.session?.refresh_token,
    });
  } catch (err: any) {
    console.error("Login error:", err);

    res.status(500).json({
      success: false,
      error: "SERVER_ERROR",
      message: err?.message || "Unexpected server error",
    });
  }
};