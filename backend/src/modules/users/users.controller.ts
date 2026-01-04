import { Controller, Post, InternalServerErrorException } from "@nestjs/common";
import { DataSource } from "typeorm";

@Controller("users")
export class UsersController {
  constructor(private dataSource: DataSource) {}

  @Post("seed-manager")
  async seedManager() {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      // 1. Add 'FACILITY_MANAGER' to enum if not exists
      // Note: ALTER TYPE cannot run inside a transaction block in some Postgres versions/configs
      // but adding value strictly usually prevents rollback.
      // However, let's try. If it fails due to transaction, we run it outside.
      // Actually, ALTER TYPE ... ADD VALUE cannot run in a transaction block.
      // We should run it separately.
    } catch (err) {
      // ignore
    }
    await queryRunner.release();

    // Run migration outside transaction
    try {
      await this.dataSource.query(
        `ALTER TYPE user_role ADD VALUE 'FACILITY_MANAGER'`,
      );
    } catch (e) {
      console.log("Enum modification error (likely exists):", e.message);
    }

    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      // 2. Insert Manager User
      const existing = await qr.query(
        `SELECT * FROM users WHERE sso_id = 'MANAGER001'`,
      );
      if (existing.length === 0) {
        await qr.query(`
                    INSERT INTO users (sso_id, full_name, email, role, department, status)
                    VALUES ('MANAGER001', 'Nguyen Van Quan Ly', 'manager@uni.edu.vn', 'FACILITY_MANAGER', 'Facility Dept', 'ACTIVE')
                `);
      }

      await qr.commitTransaction();
      return { message: "Manager seeded successfully", ssoId: "MANAGER001" };
    } catch (err) {
      await qr.rollbackTransaction();
      throw new InternalServerErrorException(err.message);
    } finally {
      await qr.release();
    }
  }
}
