import { PassportStrategy } from "@nestjs/passport";
import { Strategy } from "passport-oauth2";
import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { AuthService } from "../auth.service";
import { HttpService } from "@nestjs/axios";
import { lastValueFrom } from "rxjs";

@Injectable()
export class OAuth2Strategy extends PassportStrategy(Strategy, "oauth2") {
  constructor(
    private authService: AuthService,
    private httpService: HttpService,
  ) {
    super({
      authorizationURL:
        process.env.OAUTH2_AUTH_URL ||
        "https://devhcmutsso.namanhishere.com/oauth/authorize",
      tokenURL:
        process.env.OAUTH2_TOKEN_URL ||
        "https://devhcmutsso.namanhishere.com/oauth/token",
      clientID: process.env.OAUTH2_CLIENT_ID || "client_id",
      clientSecret: process.env.OAUTH2_CLIENT_SECRET || "client_secret",
      callbackURL:
        process.env.OAUTH2_REDIRECT_URI ||
        "http://localhost:3500/api/auth/oauth2/redirect",
      scope: ["read"],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: (err: any, user: any) => void,
  ): Promise<any> {
    try {
      // If profile is empty (stats for generic oauth2), fetch it manually
      if (!profile || Object.keys(profile).length === 0) {
        profile = await this.getUserProfile(accessToken);
      }

      const user = await this.authService.validateOAuth2User(profile);
      done(null, user);
    } catch (error) {
      done(error, false);
    }
  }

  async getUserProfile(accessToken: string): Promise<any> {
    try {
      const profileUrl =
        process.env.OAUTH2_PROFILE_URL ||
        "https://devhcmutsso.namanhishere.com/api/profile";
      const response = await lastValueFrom(
        this.httpService.get(profileUrl, {
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
      );
      return response.data;
    } catch (error) {
      console.error("Error fetching user profile:", error);
      throw new InternalServerErrorException(
        "Failed to fetch user profile from SSO",
      );
    }
  }
}
