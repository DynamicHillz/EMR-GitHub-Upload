import { PrismaClient } from '@prisma/client';

export class UpdateLabDictionaryItemUseCase {
  constructor(private prisma: PrismaClient) {}

  async execute(tenantId: string, testId: string, data: any) {
    const { name, category, price, isActive, parameters } = data;

    // Verify test belongs to tenant
    const existingTest = await this.prisma.labTest.findFirst({
      where: {
        id: testId,
        tenantId
      }
    });

    if (!existingTest) {
      throw new Error('Lab test not found or unauthorized');
    }

    // Update the test
    const labTest = await this.prisma.labTest.update({
      where: { id: testId },
      data: {
        name: name !== undefined ? name : existingTest.name,
        category: category !== undefined ? category : existingTest.category,
        price: price !== undefined ? parseInt(price) : existingTest.price,
        isActive: isActive !== undefined ? isActive : existingTest.isActive,
      }
    });

    // Handle parameters update if provided
    if (parameters && Array.isArray(parameters)) {
      // First, remove existing test parameters mapping (not the parameters themselves)
      await this.prisma.labTestParameter.deleteMany({
        where: { testId }
      });

      // Then recreate them
      for (let i = 0; i < parameters.length; i++) {
        const param = parameters[i];
        let parameterId = param.id;
        
        if (!parameterId) {
          const newParam = await this.prisma.labParameter.create({
            data: {
              tenantId,
              name: param.name,
              unit: param.unit,
              refRangeMale: param.refRangeMale,
              refRangeFemale: param.refRangeFemale,
            }
          });
          parameterId = newParam.id;
        } else {
          // parameterId comes straight from the request body — without
          // this check, any tenant's LAB_TECH/ADMIN could silently
          // overwrite another tenant's reference ranges just by
          // guessing/knowing a LabParameter id.
          const existingParam = await this.prisma.labParameter.findFirst({
            where: { id: parameterId, tenantId }
          });
          if (!existingParam) {
            throw new Error('Lab parameter not found or unauthorized');
          }

          await this.prisma.labParameter.update({
            where: { id: parameterId },
            data: {
              name: param.name,
              unit: param.unit,
              refRangeMale: param.refRangeMale,
              refRangeFemale: param.refRangeFemale,
            }
          });
        }

        // Link parameter to test
        await this.prisma.labTestParameter.create({
          data: {
            testId: labTest.id,
            parameterId: parameterId,
            displayOrder: param.displayOrder || i,
          }
        });
      }
    }

    return this.prisma.labTest.findUnique({
      where: { id: labTest.id },
      include: {
        parameters: {
          include: {
            parameter: true
          }
        }
      }
    });
  }
}
