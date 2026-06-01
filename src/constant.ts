export const dataStatus = {
    ACTIVE: 'active',
    ARCHIVE: 'archive'
} as const;

export type TDataStatus = (typeof dataStatus)[keyof typeof dataStatus];

export const dataStatusEnum = Object.values(dataStatus);
