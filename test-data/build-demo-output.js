const writeExcelFile = require('write-excel-file/node');
const path = require('path');

const demoAnswers = [
  ['ID', 'Category', 'Question', 'QuestForgeAI Answer', 'Confidence', 'Review Flag'],
  ['Q1', 'General', 'Please describe your company, including year founded, headquarters location, and number of employees.',
    'Acme Cloud Technologies is a B2B SaaS company providing workforce analytics software to enterprise clients. Founded in 2019, headquartered in Austin, TX, with a remote engineering team across the US and UK. 85 employees.',
    'HIGH', ''],
  ['Q2', 'General', 'What compliance certifications does your organization currently hold?',
    'Based on the provided documentation, Acme Cloud Technologies maintains SOC 2 Type II and ISO 27001 documentation. The client team should verify current certificate dates before submission.',
    'MEDIUM', 'Verify dates before submission'],
  ['Q3', 'Infrastructure', 'Where is your production infrastructure hosted?',
    'Production systems are hosted on AWS in us-east-1 and eu-west-1. Infrastructure is managed using Terraform with version-controlled configurations.',
    'HIGH', ''],
  ['Q4', 'Encryption', 'Describe how data is encrypted at rest.',
    'Data at rest is encrypted using AWS-managed encryption services. Customer-managed keys may be available for enterprise deployments, subject to client confirmation.',
    'MEDIUM', 'Confirm customer-managed key availability'],
  ['Q5', 'Encryption', 'Describe how data is encrypted in transit.',
    'TLS is enforced for customer-facing endpoints and internal service communication according to the supplied security policy.',
    'HIGH', ''],
  ['Q6', 'Access Control', 'Do you enforce multi-factor authentication?',
    'Yes. The documentation states that employee access to production systems requires multi-factor authentication.',
    'HIGH', ''],
  ['Q7', 'Vulnerability Management', 'Do you conduct regular penetration testing?',
    'Annual third-party penetration testing is documented. The client team should attach or reference the latest report under NDA if requested.',
    'HIGH', ''],
  ['Q8', 'Incident Response', 'What is your customer notification timeline for security breaches?',
    '[NEEDS REVIEW] This question requires legal and security team confirmation because notification timelines are usually contract-specific.',
    'LOW', 'LEGAL, confirm contractual notification commitment'],
  ['Q9', 'Business Continuity', 'What are your RPO and RTO?',
    '[NEEDS REVIEW] The supplied documentation references disaster recovery testing, but exact RPO and RTO commitments were not found.',
    'LOW', 'LEGAL, confirm SLA terms'],
  ['Q10', 'Data Privacy', 'List your subprocessors.',
    'Current subprocessors should be listed from the client-approved subprocessor register. The supplied documentation references AWS and selected SaaS vendors, but the final list should be verified before submission.',
    'LOW', 'Verify current subprocessor list'],
];

const summaryData = [
  ['QuestForgeAI SAMPLE COMPLETION REPORT'],
  [],
  ['Company', 'Acme Cloud Technologies'],
  ['Prospect', 'Enterprise Corp'],
  ['Date', new Date().toLocaleDateString()],
  [],
  ['RESULTS SUMMARY'],
  ['Total Questions', 10],
  ['High Confidence', 6],
  ['Medium Confidence', 2],
  ['Flagged for Human Review', 3],
  ['Legal/Contractual Flags', 2],
  ['Ready to Submit %', '80%'],
  [],
  ['FLAGGED ITEMS, REVIEW BEFORE SUBMITTING'],
  ['ID', 'Question', 'Reason'],
  ['Q8', 'Customer notification timeline for breaches', 'Review contractual notification commitments'],
  ['Q9', 'RPO and RTO commitments', 'Verify RPO/RTO against SLA terms'],
  ['Q10', 'Subprocessor list', 'Verify current approved list'],
  [],
  ['NOTE', 'This sample demonstrates the format of a human-reviewed QuestForgeAI pilot deliverable.'],
];

async function main() {
  const outputPath = path.join(__dirname, '..', 'output', 'QuestForgeAI_Sample_Output.xlsx');
  await writeExcelFile([
    {
      sheet: 'Completed Questionnaire',
      data: demoAnswers,
      columns: [{ width: 5 }, { width: 22 }, { width: 70 }, { width: 90 }, { width: 14 }, { width: 45 }],
      stickyRowsCount: 1,
    },
    {
      sheet: 'Summary Report',
      data: summaryData,
      columns: [{ width: 18 }, { width: 72 }, { width: 56 }],
      stickyRowsCount: 1,
    },
  ]).toFile(outputPath);
  console.log('Demo output created:', outputPath);
}

main().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
