import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config/env.js';
import User from '../models/User.js';

export const authRequired = async (req, res, next) => {
  try {
    const token = req.cookies?.token;
    if (!token) return res.status(401).json({ message: 'Unauthorized' });

    const payload = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(payload.sub);
    if (!user) return res.status(401).json({ message: 'Unauthorized' });

    req.user = user;

    next();
  } catch {
    res.status(401).json({ message: 'Unauthorized' });
  }
};

export const issueJwt = (res, user) => {
  const token = jwt.sign({ sub: user._id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
  res.cookie('token', token, {
    httpOnly: true, sameSite: 'lax', secure: false, // set secure:true on HTTPS
    maxAge: 7 * 24 * 60 * 60 * 1000
  });
};
