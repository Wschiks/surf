#!/bin/sh
# Make the live build, archive the iPhone app and upload it to App Store Connect (TestFlight), signed with the Apple
# account that is signed in to Xcode. Raise the build number in Xcode (CURRENT_PROJECT_VERSION) before every upload.
# Usage: npm run phone:upload:ios
set -e
npm run phone:sync:live
VERSION=$(node -p "require('./package.json').version")
BUILD=$(grep -m1 'CURRENT_PROJECT_VERSION' ios/App/App.xcodeproj/project.pbxproj | sed 's/[^0-9]//g')
ARCH="$HOME/Library/Developer/Xcode/Archives/$(date +%Y-%m-%d)/SurfTycoon $VERSION ($BUILD).xcarchive"
xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Release -destination 'generic/platform=iOS' -archivePath "$ARCH" -allowProvisioningUpdates archive
xcodebuild -exportArchive -archivePath "$ARCH" -exportOptionsPlist ios/ExportOptions.plist -exportPath "${TMPDIR:-/tmp}/surf-export" -allowProvisioningUpdates
echo "Uploaded Surf Tycoon $VERSION ($BUILD) to App Store Connect."
