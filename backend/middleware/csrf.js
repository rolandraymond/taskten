const lusca = require('lusca');

const csrfMiddleware = lusca.csrf({
    header: 'x-csrf-token',
    cookie: false,
});

const csrfProtection = (req, res, next) => {
    if (
        process.env.NODE_ENV === 'test' ||
        req.currentUser || // ✅ تعديل الاسم عشان يطابق الـ Auth Middleware بتاعك
        req.user || // نسيب دي احتياطي لو مكتبة تانية بتستخدمها زي Passport
        req.headers.authorization?.startsWith('Bearer ') // لو بتبعت JWT Token فانت مش محتاج CSRF أصلاً
    ) {
        return next();
    }

    return lusca.csrf({
        header: 'x-csrf-token',
        cookie: false,
    })(req, res, next);
};

const generateToken = (req, res) => {
    if (typeof req.csrfToken === 'function') {
        return req.csrfToken();
    }
    if (res.locals._csrf) {
        return res.locals._csrf;
    }
    return '';
};

module.exports = {
    csrfProtection,
    csrfMiddleware,
    generateToken,
};
