import { UserRepository } from './user.repository';
import { UploadService } from '@/feature/upload/upload.service';
import { ActivityLogService } from '@/feature/activity-log/activity-log.service';
import { NotFoundException } from '@/exceptions';
import type { TGetUserListQuery, TUpdateUser } from './user.types';

export class UserService {
    private userRepository: UserRepository;
    private uploadService: UploadService;
    private activityLogService: ActivityLogService;

    constructor() {
        this.userRepository = new UserRepository();
        this.uploadService = new UploadService();
        this.activityLogService = new ActivityLogService();
    }

    async getList(params: TGetUserListQuery) {
        return this.userRepository.getList(params);
    }

    async getUserById(id: string) {
        const user = await this.userRepository.findById(id);
        if (!user) {
            throw new NotFoundException('User not found');
        }
        return user;
    }

    async createUser(data: import('./user.types').TCreateUser, actorId: string) {
        // Check for duplicate email or username
        const conflict = await this.userRepository.findConflict(data.email, data.username);
        if (conflict) {
            const { ConflictException } = await import('@/exceptions');
            if (conflict.email === data.email) {
                throw new ConflictException('An account with this email already exists.');
            }
            throw new ConflictException('An account with this username already exists.');
        }

        const newUser = await this.userRepository.createUser(data);

        // Log the successful creation activity
        await this.activityLogService.logActivity({
            actorId,
            title: 'Create User',
            details: `Successfully created user account for ${newUser.username} (${newUser.email}).`
        });

        return newUser;
    }

    async updateUser(id: string, data: TUpdateUser, actorId: string) {
        // Ensure user exists first
        const user = await this.getUserById(id);

        const updatedUser = await this.userRepository.updateUser(id, data);

        // Log the successful update activity
        await this.activityLogService.logActivity({
            actorId,
            title: 'Update User',
            details: `Successfully updated user details for ${user.username} (${user.email}).`
        });

        return updatedUser;
    }

    async deleteUser(id: string, actorId: string) {
        // Ensure user exists first
        const user = await this.getUserById(id);

        await this.userRepository.softDeleteUser(id);

        // Log the successful delete activity
        await this.activityLogService.logActivity({
            actorId,
            title: 'Delete User',
            details: `Successfully soft-deleted user ${user.username} (${user.email}).`
        });
    }

    async uploadProfilePicture(id: string, file: Express.Multer.File, actorId: string) {
        // Ensure user exists first
        const user = await this.getUserById(id);

        // Upload the image using our new uploadService
        const { url } = await this.uploadService.uploadImage(file);

        // Update profilePhoto URL in the DB
        await this.userRepository.updateProfilePhoto(id, url);

        // Log activity
        await this.activityLogService.logActivity({
            actorId,
            title: 'Upload Profile Picture',
            details: `Successfully uploaded a new profile photo for user ${user.username}.`
        });

        return { url };
    }
}
