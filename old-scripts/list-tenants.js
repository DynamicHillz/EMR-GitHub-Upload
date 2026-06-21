const {PrismaClient} = require('@prisma/client');
const prisma = new PrismaClient();

prisma.tenant.findMany()
  .then(tenants => {
    console.log('Tenants found:', tenants.length);
    tenants.forEach(t => {
      console.log(`  - ${t.name} (${t.id})`);
    });
    return prisma.user.findMany();
  })
  .then(users => {
    console.log('\nUsers found:', users.length);
    users.forEach(u => {
      console.log(`  - ${u.email} (${u.role})`);
    });
  })
  .catch(e => console.error('Error:', e.message))
  .finally(() => prisma.$disconnect());
