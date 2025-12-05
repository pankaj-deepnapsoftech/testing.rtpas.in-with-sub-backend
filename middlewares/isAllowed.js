const { TryCatch, ErrorHandler } = require('../utils/error');

exports.isAllowed = TryCatch(async (req, res, next) => {
    const route = req.originalUrl.split('/')[2];

    const user = req.user;
    if (!user) {
        throw new ErrorHandler('User not found', 401);
    }
    if (user.isSuper) {
        return next();
    }

    const permissions = user.role?.permissions;
    if (!permissions || permissions.length === 0 || !permissions.includes(route)) {
        throw new ErrorHandler('You are not allowed to access this route', 401);
    }

    next();
});
