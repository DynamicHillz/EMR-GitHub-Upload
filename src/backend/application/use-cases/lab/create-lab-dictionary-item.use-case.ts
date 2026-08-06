import { PrismaClient } from '@prisma/client';

export class CreateLabDictionaryItemUseCase {
  constructor(private prisma: PrismaClient) {}

  async execute(tenantId: string, data: any) {
    const { name, category, price, isActive, parameters } = data;

    // Create the test
    const labTest = await this.prisma.labTest.create({
      data: {
        tenantId,
        name,
        category,
        price: parseInt(price) || 0,
        isActive: isActive !== undefined ? isActive : true,
      }
    });

    // If parameters are provided, create them and link them
    if (parameters && Array.isArray(parameters) && parameters.length > 0) {
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
          // parameterId comes straight from the request body — verify it's
          // actually this tenant's before linking it, otherwise another
          // tenant's LabParameter could be attached to this test.
          const existingParam = await this.prisma.labParameter.findFirst({
            where: { id: parameterId, tenantId }
          });
          if (!existingParam) {
            throw new Error('Lab parameter not found or unauthorized');
          }
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
