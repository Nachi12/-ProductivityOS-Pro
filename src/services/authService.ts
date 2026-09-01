import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User, IUser } from '../models/User.js';
import { env } from '../config/env.js';

export class AuthService {
  static async registerUser(email: string, password: string, displayName: string) {
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      throw new Error('An account with this email address already exists.');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    const uid = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const user = await User.create({
      uid,
      email: email.toLowerCase(),
      displayName,
      passwordHash,
      role: 'user'
    });

    const token = this.generateToken(user);
    return { user, token };
  }

  static async loginUser(email: string, password: string) {
    const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash');
    if (!user || !user.passwordHash) {
      throw new Error('Invalid email or password.');
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      throw new Error('Invalid email or password.');
    }

    const token = this.generateToken(user);
    return { user, token };
  }

  static generateToken(user: IUser): string {
    return jwt.sign(
      {
        uid: user.uid,
        email: user.email,
        role: user.role,
        familyId: user.familyId
      },
      env.JWT_SECRET,
      { expiresIn: '7d' }
    );
  }
}
