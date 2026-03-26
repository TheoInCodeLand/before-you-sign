// middleware/audit.js
const pool = require('../database/init-db');

async function auditLog(req, res, next) {
    const originalSend = res.send;
    
    res.send = function(data) {
        // Log significant actions
        if (req.method !== 'GET' && req.session.userId) {
            pool.query(`
                INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address)
                VALUES ($1, $2, $3, $4, $5, $6)
            `, [
                req.session.userId,
                req.method,
                req.baseUrl,
                req.params.id || null,
                JSON.stringify(req.body),
                req.ip
            ]).catch(console.error);
        }
        originalSend.call(this, data);
    };
    next();
}

module.exports = auditLog;