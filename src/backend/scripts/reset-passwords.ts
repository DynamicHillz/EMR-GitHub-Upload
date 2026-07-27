// Local one-off maintenance script only — run by hand against a local/dev
// database when a specific account is locked out. Prints the new plaintext
// password to the console, which is fine for that use case (an operator
// running it directly at a trusted machine's terminal) but would leak
// credentials into logs/history if this were ever adapted into anything
// networked, scheduled, or run against a remote/CI environment. Don't reuse
// this pattern for anything beyond an interactive local run.
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const newPassword = 'Password123!';
  const hashedPassword = await bcrypt.hash(newPassword, 10); // Standard salt rounds

  console.log('Resetting passwords to:', newPassword);

  const emails = ['hillary@ssmc.com', 'admin@hospital.com'];

  for (const email of emails) {
    const result = await prisma.user.updateMany({
      where: { email },
      data: { password: hashedPassword }
    });
    console.log(`Successfully reset password for ${email}. Affected rows: ${result.count}`);
  }
}

main().finally(() => prisma.$disconnect());
