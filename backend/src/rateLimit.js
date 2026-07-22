function createRateLimiter({ windowMs, maxRequests, message }) {
  const attempts = new Map();
  return (req, res, next) => {
    const ip = req.ip || 'unknown';
    const now = Date.now();
    const recent = (attempts.get(ip) || []).filter((t) => now - t < windowMs);
    if (recent.length >= maxRequests) {
      return res.status(429).json({ error: message });
    }
    recent.push(now);
    attempts.set(ip, recent);
    next();
  };
}

module.exports = { createRateLimiter };
