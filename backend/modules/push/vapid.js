const webpush = require('web-push');

const publicKey = process.env.VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY;
const subject = process.env.VAPID_SUBJECT || 'mailto:admin@example.com';

if (publicKey && privateKey) {
    webpush.setVapidDetails(subject, publicKey, privateKey);
}

module.exports = {
    webpush,
    publicKey,
    privateKey,
    isConfigured: Boolean(publicKey && privateKey),
};