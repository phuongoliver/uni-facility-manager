import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from '../users/users.module';
import { OAuth2Strategy } from './strategies/oauth2.strategy';
import { HttpModule } from '@nestjs/axios';
import { PassportModule } from '@nestjs/passport';

@Module({
    imports: [UsersModule, PassportModule, HttpModule],
    providers: [AuthService, OAuth2Strategy],
    controllers: [AuthController],
})
export class AuthModule { }
