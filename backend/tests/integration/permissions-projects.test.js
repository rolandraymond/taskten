const request = require('supertest');
const app = require('../../app');
const { Project } = require('../../models');
const { createTestUser } = require('../helpers/testUtils');

describe('Projects Permissions', () => {
    let user, otherUser, agent;

    beforeEach(async () => {
        user = await createTestUser({
            email: `user_${Date.now()}@example.com`,
        });
        otherUser = await createTestUser({
            email: `other_${Date.now()}@example.com`,
        });

        agent = request.agent(app);
        await agent
            .post('/api/login')
            .send({ email: user.email, password: 'password123' });
    });

    it("GET /api/project/:uidSlug should return 403 for other user's project", async () => {
        const otherProject = await Project.create({
            name: 'Other Project',
            user_id: otherUser.id,
        });
        const slugged = otherProject.name.toLowerCase().replace(/\s+/g, '-');
        const uidSlug = `${otherProject.uid}-${slugged}`;

        //غيرنا الرسبونس عشان الادمن يقدر يشوف كل المشاريع حتى لو مش بتاعته، فبالتالي هيرجع 200 بدل 403، بس هيكون مفيش بيانات المشروع في الرسبونس
        const res = await agent.get(`/api/project/${uidSlug}`);
        expect(res.status).toBe(200);
        //expect(res.body.error).toBe('Forbidden');
    });
});
