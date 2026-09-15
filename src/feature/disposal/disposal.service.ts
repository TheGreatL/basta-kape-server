import { DisposalRepository } from './disposal.repository';
import type { TGetDisposalListQuery, TGetDisposalSummaryQuery } from './disposal.types';

export class DisposalService {
    private repository: DisposalRepository;

    constructor() {
        this.repository = new DisposalRepository();
    }

    /**
     * Gets paginated disposal logs across raw ingredients and prepared food.
     */
    async getDisposalLogs(params: TGetDisposalListQuery) {
        return this.repository.getDisposalLogs(params);
    }

    /**
     * Gets summary financial loss metrics and top-wasted items.
     */
    async getDisposalSummary(params: TGetDisposalSummaryQuery) {
        return this.repository.getDisposalSummary(params);
    }
}
