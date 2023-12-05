import * as cn from '../src/constants'

describe('constants', () => {
  it('should have AWS_ACCOUNT_ID defined', () => {
    expect(cn.AWS_ACCOUNT_ID).toBeDefined()
  })

  it('should have AWS_REGION defined', () => {
    expect(cn.AWS_REGION).toBeDefined()
  })

  it('should have APP_NAME defined', () => {
    expect(cn.APP_NAME).toBeDefined()
  })

  it('should have READY2RUN_WORKFLOW_ID defined', () => {
    expect(cn.READY2RUN_WORKFLOW_ID).toBeDefined()
  })

  it('should have NOTIFICATION_EMAIL defined', () => {
    expect(cn.NOTIFICATION_EMAIL).toBeDefined()
  })

  it('should have INPUT_BUCKET defined', () => {
    expect(cn.INPUT_BUCKET).toBeDefined()
  })

  it('should have OUTPUT_BUCKET defined', () => {
    expect(cn.OUTPUT_BUCKET).toBeDefined()
  })

  it('should have MANIFEST_PREFIX defined', () => {
    expect(cn.MANIFEST_PREFIX).toBeDefined()
    expect(cn.MANIFEST_PREFIX).toEqual(`fastq/${cn.AWS_REGION}`)
  })

  it('should have MANIFEST_SUFFIX defined', () => {
    expect(cn.MANIFEST_SUFFIX).toBeDefined()
  })
})
