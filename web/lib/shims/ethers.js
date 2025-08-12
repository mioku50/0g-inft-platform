const ethersModule = require('ethers')

module.exports = {
  ...ethersModule,
  utils: { ...ethersModule }
}
