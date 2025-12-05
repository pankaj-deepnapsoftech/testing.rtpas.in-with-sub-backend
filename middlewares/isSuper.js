const {TryCatch, ErrorHandler} = require('../utils/error');

exports.isSuper = TryCatch(async (req, res, next)=>{
    if (!req.user?.isSuper) {
        throw new ErrorHandler('You must be a superadmin to access this route', 401);
    }
    next();
})