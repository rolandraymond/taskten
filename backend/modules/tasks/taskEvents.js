'use strict';

// ✅ ده الـ EventEmitter الخاص بـ domain events
// اتعمل في ملف منفصل عشان events.js مستخدم كـ Express Router
// وعشان نفصل بين الـ HTTP routing والـ domain events

const EventEmitter = require('events');

const taskEvents = new EventEmitter();

// زيادة الـ limit عشان متجيش warning لو زاد عدد الـ listeners في المستقبل
taskEvents.setMaxListeners(30);

module.exports = taskEvents;
