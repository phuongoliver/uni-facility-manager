import { Controller, Post, Body, HttpCode, HttpStatus, Get, UseGuards, Req, Res } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
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

    @Get('oauth2')
    @UseGuards(AuthGuard('oauth2'))
    async oauth2Auth(@Req() req) { }

    // Scenario A: Backend Redirect (if configured)
    @Get('oauth2/redirect')
    @UseGuards(AuthGuard('oauth2'))
    async oauth2AuthRedirect(@Req() req, @Res() res) {
        const loginData = await this.authService.login(req.user);

        // Redirect to frontend
        const frontendUrl = 'http://localhost:3001/sso-callback';
        res.redirect(`${frontendUrl}?data=${encodeURIComponent(JSON.stringify(loginData))}`);
    }

    // Scenario B: Frontend received code, exchanging it here
    @Post('exchange-sso')
    async exchangeSso(@Body('code') code: string) {
        return this.authService.exchangeSsoToken(code);
    }
}
