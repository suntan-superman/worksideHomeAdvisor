git fetch origin
git reset --hard origin/main
git clean -fd
npm install

cd apps/mobile
rm -rf ios android
npx expo prebuild --clean
cd ios
pod install
cd ..

open ios/*.xcworkspace
