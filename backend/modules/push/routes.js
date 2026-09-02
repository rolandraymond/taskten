const express = require('express');
const router = express.Router();
const service = require('./service');
const { publicKey } = require('./vapid');

router.get('/push/vapid-public-key', (req, res) => {
    res.json({
        publicKey,
    });
});

router.post('/push/subscribe', async (req, res, next) => {
    try {
        console.error('[PUSH SUBSCRIBE DEBUG]', {
            userId: req.currentUser?.id,
            bodyKeys: Object.keys(req.body || {}),
            hasSubscription: !!req.body?.subscription,
            hasEndpoint: !!req.body?.subscription?.endpoint,
            hasP256dh: !!req.body?.subscription?.keys?.p256dh,
            hasAuth: !!req.body?.subscription?.keys?.auth,
        });

        const subscription = await service.subscribe(
            req.currentUser.id,
            req.body.subscription,
            req.get('user-agent')
        );

        console.error('[PUSH SUBSCRIBE SUCCESS]', {
            id: subscription.id,
            uid: subscription.uid,
            userId: subscription.user_id,
        });

        res.json({
            success: true,
            subscription_uid: subscription.uid,
        });
    } catch (error) {
        console.error('[PUSH SUBSCRIBE ERROR]');
        console.error('NAME:', error?.name);
        console.error('MESSAGE:', error?.message);
        console.error('STACK:', error?.stack);
        console.error('PARENT:', error?.parent);
        console.error('ORIGINAL:', error?.original);

        next(error);
    }
});

router.post('/push/unsubscribe', async (req, res, next) => {
    try {
        await service.unsubscribe(
            req.currentUser.id,
            req.body.endpoint
        );

        res.json({
            success: true,
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;