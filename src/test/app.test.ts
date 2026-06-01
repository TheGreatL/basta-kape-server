import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../app';

describe('App Integration Tests', () => {
    it('should return 200 and success message on GET /api/', async () => {
        const response = await request(app).get('/api/');
        expect(response.status).toBe(200);
        expect(response.text).toBe('Express + TypeScript Server is running');
    });

    it('should return 200 on GET /api/health', async () => {
        const response = await request(app).get('/api/health');
        expect(response.status).toBe(200);
        expect(response.text).toBe('Server is healthy');
    });
});
