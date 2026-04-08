import { verifySessionToken } from '../../services/sessionService.js';
import { UserModel } from '../auth/auth.model.js';

export async function requireAdminSession(request) {
  const authorization = request.headers.authorization || '';
  const [scheme, token] = authorization.split(' ');

  if (scheme !== 'Bearer' || !token) {
    const error = new Error('Admin authentication is required.');
    error.statusCode = 401;
    throw error;
  }

  let session;
  try {
    session = verifySessionToken(token);
  } catch {
    const error = new Error('Admin session is invalid or expired.');
    error.statusCode = 401;
    throw error;
  }

  const user = await UserModel.findById(session.sub).lean();
  if (!user) {
    const error = new Error('Admin account not found.');
    error.statusCode = 401;
    throw error;
  }

  if (user.role !== 'admin' && user.role !== 'super_admin') {
    const error = new Error('Admin privileges are required.');
    error.statusCode = 403;
    throw error;
  }

  return {
    session,
    user,
  };
}
