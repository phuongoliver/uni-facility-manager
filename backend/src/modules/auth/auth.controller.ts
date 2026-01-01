import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) { }

    @Post('login-mock')
    @HttpCode(HttpStatus.OK)
    async loginMock(@Body('ssoId') ssoId: string) {
        if (!ssoId) {
            // Default to student if not provided, or handle error
            ssoId = '20110456';
        }
        return this.authService.loginMock(ssoId);
    }
}
