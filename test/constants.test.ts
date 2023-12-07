import Constants from '../src/constants';

describe('Constants', () => {
  let constants: Constants;
  let env: any;

  beforeEach(() => {
    env = {
      bucket: 's3://quilt-example',
      computeEnvId: 'ce-1234567890abcdef',
    };
    constants = new Constants(env);
  });

  describe('GetPackageName', () => {
    it('should return the package name from an absolute path', () => {
      const filePath = '/GitHub/vivos/src/constants.ts';
      const packageName = Constants.GetPackageName(filePath);
      expect(packageName).toEqual('GitHub/vivos');
    });
    it('should return the package name from a relative path', () => {
      const filePath = 'GitHub/vivos/src/constants.ts';
      const packageName = Constants.GetPackageName(filePath);
      expect(packageName).toEqual('GitHub/vivos');
    });
  });
  describe('GetRegion', () => {
    it('should return the region from the environment', () => {
      const region = Constants.GetRegion();
      expect(region).toEqual(constants.region);
      expect(region).toEqual('us-east-1');
    });
  });
  describe('LoadObjectURI', () => {
    it('should load yaml URI correctly', async () => {
      const uri = 's3://quilt-demo/examples/volcano-plot/Vega_volcano.json'; // TODO: per-region test buckets!
      console.debug(`LoadObjectURI ${uri}`);
      const result = await Constants.LoadObjectURI(uri);
      expect(result).toBeDefined();
      expect(result).toHaveProperty('data');
    });
    it('should throw an error if the object URI is invalid', async () => {
      const nonExistentURI = 'https://quilt-example.com';
      await expect(Constants.LoadObjectURI(nonExistentURI)).rejects.toThrow();
    });
  });


  it('should get the correct value for a given key', () => {
    const key = 'APP_NAME';
    const expectedValue = 'omics-quilt';

    const result = constants.get(key);
    expect(result).toEqual(expectedValue);
  });

  it('should put a value for a given key', () => {
    const key = 'APP_NAME';
    const value = 'demo-app';

    constants.put(key, value);

    const result = constants.get(key);
    expect(result).toEqual(value);
  });

  describe('GetKeyPathFromFile', () => {
    function checkKeyPathValue(keyPath: string, value: string) {
      const filePath = Constants.DEFAULTS.TEST_KEYED_FILE;
      const result = Constants.GetKeyPathFromFile(filePath, keyPath);
      expect(result).toEqual(value);
    }

    it('should return the value for a given key path', () => {
      checkKeyPathValue('platform', 'illumina');
    });

    it('should return undefined if the key path does not exist', () => {
      const filePath = Constants.DEFAULTS.TEST_KEYED_FILE;
      const keyPath = 'undefined.Pipeline.value';
      const result = Constants.GetKeyPathFromFile(filePath, keyPath);
      expect(result).toBeUndefined();
    });

    it('should return undefined if the file does not exist', () => {
      const filePath = './test/data/nonExistentFile.json';
      const keyPath = 'id';
      const result = Constants.GetKeyPathFromFile(filePath, keyPath);
      expect(result).toBeUndefined();
    });
  });

});
