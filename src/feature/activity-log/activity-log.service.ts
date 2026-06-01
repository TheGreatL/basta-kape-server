import { ActivityLogRepository } from './activity-log.repository';
import { z } from 'zod';
import { GetActivityLogsQuerySchema, CreateActivityLogSchema } from './activity-log.types';

export class ActivityLogService {
    private repository: ActivityLogRepository;

    constructor() {
        this.repository = new ActivityLogRepository();
    }

    async logActivity(data: z.infer<typeof CreateActivityLogSchema>) {
        return this.repository.create(data);
    }

    async getList(query: z.infer<typeof GetActivityLogsQuerySchema>) {
        return this.repository.getList(query);
    }
}
