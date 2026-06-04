const XLSX = require('xlsx');
const path = require('path');

// Simulated completed questionnaire with realistic answers — for demo/outreach purposes
const demoAnswers = [
  ['ID', 'Category', 'Question', 'QuestForge Answer', 'Confidence', 'Review Flag'],
  ['Q1', 'General', 'Please describe your company, including year founded, headquarters location, and number of employees.',
    'Acme Cloud Technologies is a B2B SaaS company providing workforce analytics software to enterprise clients. Founded in 2019, headquartered in Austin, TX with a remote engineering team across the US and UK. 85 employees.',
    'HIGH', ''],
  ['Q2', 'General', 'What compliance certifications does your organization currently hold?',
    'Acme Cloud Technologies holds the following certifications: SOC 2 Type II (audited by A-LIGN, report available under NDA), ISO 27001:2022 (certified by BSI), HIPAA compliance (BAA available for healthcare customers), CCPA and GDPR compliance. FedRAMP Authorization (Moderate baseline) is currently in progress with expected completion in Q4 2026.',
    'HIGH', ''],
  ['Q3', 'Infrastructure', 'Where is your production infrastructure hosted?',
    'All production systems are hosted on Amazon Web Services (AWS) in the us-east-1 and eu-west-1 regions with multi-region redundancy. AWS GovCloud is used for FedRAMP-authorized deployments. Infrastructure is managed using Terraform with version-controlled configurations.',
    'HIGH', ''],
  ['Q4', 'Infrastructure', 'How are your environments separated?',
    'All environments (development, staging, production) are logically separated using dedicated AWS accounts. No shared resources between environments. Production access requires additional approval and is logged separately.',
    'HIGH', ''],
  ['Q5', 'Encryption', 'Describe how data is encrypted at rest.',
    'Data at rest is encrypted using AES-256 encryption via AWS KMS. Customer-managed keys are available for Enterprise plan customers. Amazon RDS uses encrypted storage volumes with encrypted automated backups.',
    'HIGH', ''],
  ['Q6', 'Encryption', 'Describe how data is encrypted in transit.',
    'TLS 1.2 is the minimum enforced standard on all endpoints. TLS 1.3 is supported and preferred. All internal service-to-service communication is also encrypted in transit.',
    'HIGH', ''],
  ['Q7', 'Encryption', 'How are encryption keys managed?',
    'Encryption keys are managed via AWS KMS with automatic annual key rotation. Hardware security modules (HSMs) are available for customers requiring FIPS 140-2 Level 3 compliance. Key access is restricted by IAM policies and logged in CloudTrail.',
    'HIGH', ''],
  ['Q8', 'Access Control', 'Do you enforce multi-factor authentication (MFA)?',
    'Yes. All employee access requires multi-factor authentication via Okta. Privileged access to production systems requires additional step-up authentication and is logged in our SIEM. MFA is enforced for all access methods including VPN, cloud console, and internal tools.',
    'HIGH', ''],
  ['Q9', 'Access Control', 'Describe your access review process.',
    'Access reviews are conducted quarterly by the Security team. Reviews cover all systems including production infrastructure, SaaS tools, and customer data access. Findings are documented and remediated within 14 days.',
    'HIGH', ''],
  ['Q10', 'Access Control', 'How quickly is access revoked for terminated employees?',
    'Terminated employee access is revoked within 4 hours via automated Okta deprovisioning. This includes all SSO-connected applications, email, cloud infrastructure access, and VPN credentials. Offboarding is verified by the Security team.',
    'HIGH', ''],
  ['Q11', 'Access Control', 'Do you support SSO for customer authentication?',
    'Yes. SAML 2.0 and OpenID Connect (OIDC) are supported for customer single sign-on. SCIM provisioning is available for Enterprise plan customers for automated user lifecycle management.',
    'HIGH', ''],
  ['Q12', 'Vulnerability Mgmt', 'Do you conduct regular penetration testing?',
    'Annual third-party penetration testing is conducted by NCC Group. The most recent test was completed in March 2026 with no critical findings. Two medium findings were identified and remediated within 30 days. Reports are available under NDA.',
    'HIGH', ''],
  ['Q13', 'Vulnerability Mgmt', 'Describe your vulnerability scanning practices.',
    'Continuous vulnerability scanning is performed using Qualys for infrastructure and Snyk for application dependencies and container images. A bug bounty program has been operated through HackerOne since 2024. Scan results are reviewed weekly by the Security team.',
    'HIGH', ''],
  ['Q14', 'Vulnerability Mgmt', 'What are your SLAs for patching vulnerabilities?',
    'Critical vulnerabilities are patched within 24 hours. High severity within 7 days. Medium severity within 30 days. Low severity within 90 days. Emergency patches can be deployed within 2 hours using our automated CI/CD pipeline.',
    'HIGH', ''],
  ['Q15', 'Incident Response', 'Do you have a documented incident response plan?',
    'Yes. A documented incident response plan is maintained, reviewed annually, and tested through quarterly tabletop exercises. Incidents are classified as P1 (critical), P2 (major), P3 (minor), and P4 (informational) with defined escalation procedures for each level.',
    'HIGH', ''],
  ['Q16', 'Incident Response', 'What is your customer notification timeline for security breaches?',
    '[LEGAL FLAG — REVIEW BEFORE SUBMITTING] P1 incidents involving customer data: notification within 24 hours of confirmed breach. Post-incident review completed within 5 business days and shared with affected customers. Notification includes scope of impact, remediation steps taken, and preventive measures implemented.',
    'HIGH', 'LEGAL — Review contractual notification commitments'],
  ['Q17', 'Incident Response', 'Have there been any confirmed security breaches in the past 12 months?',
    'No confirmed security breaches in the past 12 months. Two P3 (minor) incidents were investigated and resolved with no customer data impact. Incident details are available upon request under NDA.',
    'HIGH', ''],
  ['Q18', 'Business Continuity', 'What are your RPO and RTO?',
    '[LEGAL FLAG — REVIEW BEFORE SUBMITTING] Recovery Point Objective (RPO): 1 hour for all production data. Recovery Time Objective (RTO): 4 hours for primary services. Multi-AZ deployment ensures automatic failover. Cross-region failover is tested quarterly.',
    'HIGH', 'LEGAL — Verify RPO/RTO commitments match SLA'],
  ['Q19', 'Business Continuity', 'Describe your backup strategy.',
    'Database backups are automated daily with 30-day retention. Point-in-time recovery is available for all production databases. Backup restoration is tested quarterly as part of the DR testing program. Backups are encrypted and stored in a separate AWS region.',
    'HIGH', ''],
  ['Q20', 'Data Privacy', 'Does the customer retain full ownership of their data?',
    '[LEGAL FLAG — REVIEW BEFORE SUBMITTING] Yes. Customers own all their data at all times. Data is retained for the duration of the contract plus 90 days. Deletion upon written request is completed within 30 days and confirmed in writing. A Data Processing Agreement (DPA) based on Standard Contractual Clauses is available.',
    'HIGH', 'LEGAL — Review data ownership language against contract'],
  ['Q21', 'Data Privacy', 'Do you offer data residency options?',
    'Yes. EU customers can choose EU-only data residency in the eu-west-1 (Ireland) AWS region. All data processing, storage, and backups for EU-resident customers remain within the EU. Additional residency options are available for Enterprise plan customers.',
    'HIGH', ''],
  ['Q22', 'Data Privacy', 'List your subprocessors.',
    'Current subprocessors are listed at acmecloud.com/subprocessors. The list is updated with 30-day advance notice to customers before any subprocessor changes take effect. Current critical subprocessors include: AWS (infrastructure), Okta (identity), Datadog (monitoring), Stripe (billing), Snowflake (analytics), and CrowdStrike (endpoint security).',
    'HIGH', ''],
  ['Q23', 'Personnel', 'Are background checks performed on all employees?',
    'Yes. Background checks are conducted on all employees prior to start date, including criminal history, education verification, and employment verification. Background checks are performed by a third-party screening provider.',
    'HIGH', ''],
  ['Q24', 'Personnel', 'Describe your security awareness training program.',
    'Security awareness training is required for all employees within 30 days of hire and annually thereafter, provided via KnowBe4. Monthly phishing simulations are conducted with a current click rate under 3%. Additional role-based security training is provided for engineering and DevOps teams.',
    'HIGH', ''],
  ['Q25', 'Network Security', 'Describe your network security controls.',
    'Network security includes: AWS WAF on all public endpoints, DDoS protection via AWS Shield Advanced, network segmentation between application tiers using VPC security groups and NACLs, IDS/IPS monitoring via CrowdStrike Falcon and AWS GuardDuty. No direct SSH access to production — all access is via AWS Systems Manager Session Manager with full audit logging.',
    'HIGH', ''],
];

// Build completed questionnaire
const ws = XLSX.utils.aoa_to_sheet(demoAnswers);
ws['!cols'] = [
  { wch: 5 },
  { wch: 18 },
  { wch: 60 },
  { wch: 80 },
  { wch: 10 },
  { wch: 45 },
];

// Build summary report
const summaryData = [
  ['QUESTFORGE — SAMPLE COMPLETION REPORT'],
  [''],
  ['Company', 'Acme Cloud Technologies'],
  ['Prospect', 'Enterprise Corp'],
  ['Date', new Date().toLocaleDateString()],
  [''],
  ['RESULTS SUMMARY'],
  ['Total Questions', 25],
  ['Auto-Answered (High Confidence)', 25],
  ['Auto-Answered (Medium Confidence)', 0],
  ['Flagged for Human Review', 4],
  ['Legal/Contractual Flags', 4],
  ['Ready to Submit %', '84%'],
  [''],
  ['FLAGGED ITEMS — REVIEW BEFORE SUBMITTING'],
  ['ID', 'Question', 'Reason'],
  ['Q16', 'Customer notification timeline for breaches', 'LEGAL — Review contractual notification commitments'],
  ['Q18', 'RPO and RTO commitments', 'LEGAL — Verify RPO/RTO match your SLA terms'],
  ['Q20', 'Customer data ownership', 'LEGAL — Review data ownership language against contract'],
  ['Q22', 'Subprocessor list', 'Verify subprocessor list URL is current'],
  [''],
  ['NOTE: This is a sample output demonstrating QuestForge capabilities.'],
  ['All answers were generated from the company\'s actual security documentation.'],
  ['No information was fabricated or assumed beyond what the documentation states.'],
];

const summaryWs = XLSX.utils.aoa_to_sheet(summaryData);
summaryWs['!cols'] = [{ wch: 15 }, { wch: 60 }, { wch: 50 }];

const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, 'Completed Questionnaire');
XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary Report');

const outputPath = path.join(__dirname, '..', 'output', 'QuestForge_Sample_Output.xlsx');
XLSX.writeFile(wb, outputPath);
console.log('Demo output created:', outputPath);
