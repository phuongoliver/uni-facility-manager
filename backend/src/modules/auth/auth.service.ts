import { Injectable, UnauthorizedException } from "@nestjs/common";
import { UsersService } from "../users/users.service";
import { User, UserRole } from "../users/entities/user.entity";
import { HttpService } from "@nestjs/axios";
import { lastValueFrom } from "rxjs";

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private httpService: HttpService,
  ) {}

  async validateUserBySsoId(ssoId: string): Promise<User> {
    const user = await this.usersService.findBySsoId(ssoId);
    if (!user) {
      throw new UnauthorizedException(
        "User not found or SSO authentication failed",
      );
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
      access_token: "mock_jwt_token_for_" + ssoId,
      user: user,
    };
  }

  async validateOAuth2User(profile: any): Promise<User> {
    // Map fields based on the actual response from the SSO profile endpoint
    // Assuming profile has id, email, first_name, last_name or similar
    console.log("SSO Profile:", profile);

    const ssoId = profile.id || profile.sub || profile.user_id;
    const email = profile.email;
    const fullName =
      profile.name ||
      profile.full_name ||
      `${profile.first_name} ${profile.last_name}`;

    if (!email) {
      // Fallback or error if email is missing.
      // Some SSOs might not return email depending on scope.
      // But we need it for our system.
    }

    let user = await this.usersService.findByEmail(email);
    if (user) return user;

    user = await this.usersService.findBySsoId(ssoId);
    if (user) return user;

    const externalRole = profile.role || profile.job_title || "student"; // Default to student
    const internalRole = this.mapExternalRoleToInternal(externalRole);

    user = await this.usersService.create({
      ssoId: String(ssoId),
      email: email,
      fullName: fullName || "Unknown User",
      role: internalRole,
      status: "ACTIVE",
    });
    return user;
  }

  private mapExternalRoleToInternal(externalRole: string): UserRole {
    const normalizedRole = externalRole.toLowerCase();

    switch (normalizedRole) {
      case "admin":
        return UserRole.ADMIN;
      case "tutor":
        // Mapping Tutor to Lecturer as they likely have similar booking privileges (or map to STUDENT if they shouldn't)
        return UserRole.LECTURER;
      case "student":
      default:
        return UserRole.STUDENT;
    }
  }

  async exchangeSsoToken(code: string) {
    try {
      const tokenUrl =
        process.env.OAUTH2_TOKEN_URL ||
        "https://devhcmutsso.namanhishere.com/oauth/token";
      const clientId = process.env.OAUTH2_CLIENT_ID || "client_id";
      const clientSecret = process.env.OAUTH2_CLIENT_SECRET || "client_secret";
      const redirectUri =
        process.env.OAUTH2_REDIRECT_URI ||
        "http://localhost:3001/auth/callback";

      // Exchange code for token
      const tokenResponse = await lastValueFrom(
        this.httpService.post(
          tokenUrl,
          {
            grant_type: "authorization_code",
            code: code,
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: redirectUri,
          },
          {
            headers: { "Content-Type": "application/json" },
          },
        ),
      );

      const accessToken = tokenResponse.data.access_token;

      // Get Profile
      const profileUrl =
        process.env.OAUTH2_PROFILE_URL ||
        "https://devhcmutsso.namanhishere.com/api/profile";
      const profileResponse = await lastValueFrom(
        this.httpService.get(profileUrl, {
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
      );

      const profile = profileResponse.data;
      const user = await this.validateOAuth2User(profile);

      return this.login(user);
    } catch (error) {
      console.error(
        "SSO Exchange Error:",
        error.response?.data || error.message,
      );
      throw new UnauthorizedException("Failed to exchange SSO code");
    }
  }

  async login(user: User) {
    return {
      access_token: "mock_jwt_token_for_" + user.ssoId,
      user: user,
    };
  }
}
