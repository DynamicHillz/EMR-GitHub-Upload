import axios from 'axios';
import { Dhis2Client } from './dhis2.client';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('Dhis2Client', () => {
  const config = { baseUrl: 'https://play.dhis2.org/dev/', username: 'admin', password: 'district' };
  const payload = { dataSet: 'X', period: '202606', orgUnit: 'ORG', dataValues: [] };

  it('POSTs to dataValueSets with basic auth, trimming a trailing slash from baseUrl', async () => {
    mockedAxios.post.mockResolvedValue({ data: { status: 'SUCCESS', importCount: { imported: 1, updated: 0, ignored: 0, deleted: 0 } } });

    const client = new Dhis2Client(config);
    await client.pushDataValueSet(payload);

    expect(mockedAxios.post).toHaveBeenCalledWith(
      'https://play.dhis2.org/dev/api/dataValueSets',
      payload,
      expect.objectContaining({ auth: { username: 'admin', password: 'district' } })
    );
  });

  it('returns ok:true with importCount on SUCCESS', async () => {
    mockedAxios.post.mockResolvedValue({ data: { status: 'SUCCESS', importCount: { imported: 3, updated: 0, ignored: 0, deleted: 0 } } });

    const result = await new Dhis2Client(config).pushDataValueSet(payload);

    expect(result).toEqual(expect.objectContaining({ ok: true, status: 'SUCCESS' }));
  });

  it('returns ok:true with status WARNING and any conflicts', async () => {
    mockedAxios.post.mockResolvedValue({
      data: { status: 'WARNING', importCount: { imported: 2, updated: 0, ignored: 1, deleted: 0 }, conflicts: [{ object: 'DE-X', value: 'bad value' }] },
    });

    const result = await new Dhis2Client(config).pushDataValueSet(payload);

    expect(result).toEqual(expect.objectContaining({ ok: true, status: 'WARNING', conflicts: [{ object: 'DE-X', value: 'bad value' }] }));
  });

  it('returns ok:false reason REJECTED when DHIS2 responds with status ERROR', async () => {
    mockedAxios.post.mockResolvedValue({ data: { status: 'ERROR', message: 'Data element does not exist' } });

    const result = await new Dhis2Client(config).pushDataValueSet(payload);

    expect(result).toEqual(expect.objectContaining({ ok: false, reason: 'REJECTED', message: 'Data element does not exist' }));
  });

  it('returns ok:false reason AUTH_ERROR on a 401 response', async () => {
    mockedAxios.post.mockRejectedValue({ response: { status: 401, data: {} } });

    const result = await new Dhis2Client(config).pushDataValueSet(payload);

    expect(result).toEqual(expect.objectContaining({ ok: false, reason: 'AUTH_ERROR' }));
  });

  it('returns ok:false reason AUTH_ERROR on a 403 response', async () => {
    mockedAxios.post.mockRejectedValue({ response: { status: 403, data: {} } });

    const result = await new Dhis2Client(config).pushDataValueSet(payload);

    expect(result).toEqual(expect.objectContaining({ ok: false, reason: 'AUTH_ERROR' }));
  });

  it('returns ok:false reason NETWORK_ERROR when the request fails with no response (e.g. DNS/timeout)', async () => {
    mockedAxios.post.mockRejectedValue(new Error('ECONNREFUSED'));

    const result = await new Dhis2Client(config).pushDataValueSet(payload);

    expect(result).toEqual(expect.objectContaining({ ok: false, reason: 'NETWORK_ERROR', message: 'ECONNREFUSED' }));
  });
});
