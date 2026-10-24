// Jenkins pipeline for the Playwright + Postgres tests in mcp-project/.
//
// When it runs:
//   - After every push to main: Jenkins checks GitHub every 5 minutes.
//   - On demand: "Build Now" in Jenkins, or ask Claude to run it.
//   (No daily schedule. Failures are triaged on request with the
//   ci-triage-agent in .claude/agents/, not inside Jenkins.)
// Every run emails the report, passed or failed, to the default recipients
// set in Jenkins (Manage Jenkins -> System -> Extended E-mail Notification).
//
// Needs these Jenkins credentials (Manage Jenkins -> Credentials):
//   postgres-db-password  Secret text            local Postgres password
//   github-deploy-key     SSH username + key     read-only access to this repo
//   gmail-smtp            Username + password    Gmail address + app password
pipeline {
  agent any

  triggers {
    pollSCM('H/5 * * * *')
  }

  options {
    timestamps()
    timeout(time: 30, unit: 'MINUTES')
    disableConcurrentBuilds()
    buildDiscarder(logRotator(numToKeepStr: '30'))
  }

  environment {
    // Jenkins runs as a macOS background service, which doesn't see Homebrew's PATH.
    PATH = "/opt/homebrew/opt/postgresql@16/bin:/opt/homebrew/bin:${env.PATH}"
    CI = 'true'

    // A separate database, reset before every run, so CI never touches the
    // one you develop against.
    DB_HOST = 'localhost'
    DB_PORT = '5432'
    DB_NAME = 'playwrightdb_ci'
    DB_USER = 'postgres'
    DB_PASSWORD = credentials('postgres-db-password')

    PLAYWRIGHT_JUNIT_OUTPUT_FILE = 'results/junit.xml'
    PLAYWRIGHT_JSON_OUTPUT_FILE = 'results/results.json'
    PLAYWRIGHT_HTML_OPEN = 'never'
  }

  stages {
    stage('Install') {
      steps {
        dir('mcp-project') {
          sh 'node -v && npm -v'
          sh 'npm ci'
          sh 'npx playwright install chromium'
        }
      }
    }

    stage('Reset CI database') {
      steps {
        dir('mcp-project') {
          sh '''
            export PGPASSWORD="$DB_PASSWORD"
            psql -h "$DB_HOST" -U "$DB_USER" -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'" | grep -q 1 \
              || psql -h "$DB_HOST" -U "$DB_USER" -d postgres -c "CREATE DATABASE $DB_NAME"
            psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -q -o /dev/null -f db/setup.sql
          '''
        }
      }
    }

    stage('Test') {
      steps {
        dir('mcp-project') {
          script {
            // Don't fail here: the junit step in post marks failed tests as UNSTABLE.
            env.PW_EXIT = sh(returnStatus: true, script: 'npx playwright test --reporter=line,junit,json,html').toString()
          }
        }
      }
    }
  }

  post {
    always {
      junit testResults: 'mcp-project/results/junit.xml', allowEmptyResults: true
      publishHTML(target: [
        reportName: 'Playwright Report',
        reportDir: 'mcp-project/playwright-report',
        reportFiles: 'index.html',
        keepAll: true,
        alwaysLinkToLastBuild: true,
        allowMissing: true,
      ])
      script {
        // Playwright exited non-zero but no test was marked failed (e.g. the
        // login in global setup broke): that's a real failure, not "unstable".
        if (env.PW_EXIT && env.PW_EXIT != '0' && currentBuild.currentResult == 'SUCCESS') {
          currentBuild.result = 'FAILURE'
        }

        def daily = !currentBuild.getBuildCauses('hudson.triggers.TimerTrigger$TimerTriggerCause').isEmpty()
        def push = !currentBuild.getBuildCauses('hudson.triggers.SCMTrigger$SCMTriggerCause').isEmpty()
        def runType = daily ? 'Daily' : (push ? 'Push' : 'Manual')
        emailext(
          to: '$DEFAULT_RECIPIENTS',
          subject: "${runType} test report: ${currentBuild.currentResult} - ${env.JOB_NAME} #${env.BUILD_NUMBER}",
          mimeType: 'text/html',
          attachmentsPattern: 'mcp-project/playwright-report/index.html',
          body: """<h2>Playwright test report: ${currentBuild.currentResult}</h2>
<p><b>Run type:</b> ${runType}<br>""" + '''
<b>Tests:</b> ${TEST_COUNTS,var="total"} total, ${TEST_COUNTS,var="pass"} passed,
${TEST_COUNTS,var="fail"} failed, ${TEST_COUNTS,var="skip"} skipped</p>
<p><b>Failed tests:</b></p>
<pre>${FAILED_TESTS,showStack=false,showMessage=true,maxTests=20}</pre>
<p><b>Changes since last run:</b><br>${CHANGES,showPaths=false,format="%a: %m<br>"}</p>
<p>The full HTML report is attached: download <code>index.html</code> and open it in a browser.<br>
Jenkins build (opens only on the Mac running Jenkins): <a href="${BUILD_URL}">${BUILD_URL}</a></p>''',
        )
      }
    }
  }
}
