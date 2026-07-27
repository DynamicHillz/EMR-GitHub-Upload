import { PrismaClient } from '@prisma/client';

export class GetLabDictionaryUseCase {
  constructor(private prisma: PrismaClient) {}

  async execute(tenantId: string, testCode?: string) {
    if (testCode) {
      return this.prisma.labTest.findFirst({
        where: {
          tenantId,
          name: testCode
        },
        include: {
          parameters: {
            include: {
              parameter: true
            },
            orderBy: {
              displayOrder: 'asc'
            }
          }
        }
      });
    }

    return this.prisma.labTest.findMany({
      where: {
        tenantId,
        isActive: true
      },
      include: {
        parameters: {
          include: {
            parameter: true
          },
          orderBy: {
            displayOrder: 'asc'
          }
        }
      }
    });
  }
}
