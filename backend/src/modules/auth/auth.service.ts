import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { User } from '../users/entities/user.entity';

@Injectable()
export class AuthService {
    constructor(private usersService: UsersService) { }

    async validateUserBySsoId(ssoId: string): Promise<User> {
        const user = await this.usersService.findBySsoId(ssoId);
        if (!user) {
            throw new UnauthorizedException('User not found or SSO authentication failed');
        }
        return user;
    }

    async loginMock(ssoId: string) {
        const user = await this.validateUserBySsoId(ssoId);
        // In a real app, successful login generates a JWT.
        // For specific demo "Login by HCMUT_SSO", we return the user profile directly 
        // or a fake token that frontend can use to "authenticate".
        // Let's return the user object and a mock token.
        return {
            access_token: 'mock_jwt_token_for_' + ssoId,
            user: user,
        };
    }
}
