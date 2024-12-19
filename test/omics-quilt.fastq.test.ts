import { TEST_EVENT } from "./fixture";
import { Constants } from "../src/constants";
import { handler, OmicsQuiltFastq } from "../src/omics-quilt.fastq";

const CONTEXT = {
    debug: true,
    local_file: "./workflows/fastq/aws_region.json",
    INPUT_S3_LOCATION: "./test/events",
    OUTPUT_S3_LOCATION: "./test/events",
    TEST_UUID: "test-uuid-0x-dead-beef",
};

describe("fastq_config_from_uri", () => {
    it("should return a single sample", async () => {
        const sample = await OmicsQuiltFastq.fastq_config_from_uri(
            CONTEXT.local_file,
        );
        expect(sample).toBeDefined();
        expect(typeof sample).toEqual("object");
        expect(sample.sample_name).toEqual("NA12878");
        const pairs = sample.fastq_pairs;
        expect(pairs.length).toEqual(1);
        const pair = pairs[0];
        expect(pair.read_group).toEqual("Sample_U0a");
        expect(pair.fastq_1).toContain(
            "NA12878/Sample_U0a/U0a_CGATGT_L001_R1_001",
        );
        expect(pair.fastq_2).toContain(
            "NA12878/Sample_U0a/U0a_CGATGT_L001_R2_001",
        );
        expect(pair.platform).toEqual("illumina");
    });
});

// test handler with TEST_EVENT and context = {debug: true}
describe("handler", () => {
    it("should run without error", async () => {
        const result = await handler(TEST_EVENT, CONTEXT);
        expect(result.message).toEqual("Success");
    });
});

describe("save_metadata", () => {
    it("should save metadata successfully", async () => {
        const omics = new OmicsQuiltFastq(TEST_EVENT, CONTEXT);
        const id = "output";
        const item = { name: "Test Item" };
        const cc = new Constants(CONTEXT);

        await omics.save_metadata(id, item);

        const root = CONTEXT.OUTPUT_S3_LOCATION + "/" + id;
        const metadata_file = cc.get("INPUT_METADATA");
        const uri = `${root}/${metadata_file}`;
        const saved = await Constants.LoadObjectURI(uri);
        expect(saved).toEqual(item);
    });
});
