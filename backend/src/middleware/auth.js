const { verifyAccessToken } = require('../utils/jwt');

function authenticate(req, res, next) {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : req.cookies?.accessToken;

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, username: payload.username };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired access token' });
  }
}

// Optional auth: attaches req.user if a valid token is present, but never blocks the request.
function optionalAuthenticate(req, _res, next) {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : req.cookies?.accessToken;
  if (token) {
    try {
      const payload = verifyAccessToken(token);
      req.user = { id: payload.sub, username: payload.username };
    } catch {
      // ignore — treated as unauthenticated
    }
  }
  next();
}

module.exports = { authenticate, optionalAuthenticate };
