import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    where: {
      role: {
        in: ['SUPER_ADMIN', 'ADMIN']
      }
    }
  });
  console.log('Admins:', users.map(u => ({ email: u.email, role: u.role })));
}

main().finally(() => prisma.$disconnect());
