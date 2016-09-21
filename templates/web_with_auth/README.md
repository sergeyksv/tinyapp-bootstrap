# __NAME__

## Installation Guide
1. Clone project to specific folder
2. Run command `npm install`
3. Install grunt `npm i grunt-cli -g`
4. Run command `grunt build`
5. Install forever `npm i forever -g`
6. Run `forever app.js`

## Preset initial data
Run command `node app.js --resetDataentry=1`
This command drops all existing collections and creates new ones, that exists
in 'dataentry' folder.
After reset users, please run `bin/hash_passwords.js`
