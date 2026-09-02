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
        const subscription = await service.subscribe(
            req.currentUser.id,
            req.body.subscription,
            req.get('user-agent')
        );

        res.json({
            success: true,
            subscription_uid: subscription.uid,
        });
    } catch (error) {
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