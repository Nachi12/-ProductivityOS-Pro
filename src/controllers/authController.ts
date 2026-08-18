import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/authService.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { User } from '../models/User.js';

export class AuthController {
  static async register(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password, displayName } = req.body;
      const { user, token } = await AuthService.registerUser(email, password, displayName);
      
      res.status(201).json({
        success: true,
        data: {
          user: {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            role: user.role
          },
          token
        }
      });
    } catch (err: any) {
      res.status(400).json({
        success: false,
        error: { code: 'REGISTRATION_FAILED', message: err.message }
      });
    }
  }

  static async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password } = req.body;
      const { user, token } = await AuthService.loginUser(email, password);

      res.json({
        success: true,
        data: {
          user: {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            role: user.role
          },
          token
        }
      });
    } catch (err: any) {
      res.status(401).json({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: err.message }
      });
    }
  }

  static async me(req: AuthenticatedRequest, res: Response) {
    try {
      const user = await User.findOne({ uid: req.user!.uid });
      res.json({
        success: true,
        data: { user: user || req.user }
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: err.message } });
    }
  }
}
