//
// MODULE
//
import React from 'react'
import {connect} from 'react-redux'
import {config} from '../../config'
import {arrayToCsv} from '../utils/arrayToCsv'

//
// ENV
//
const BUFFER_LIMIT = 100
let buffer = []
let newPlayerBuffer = []

//
// STREAMS
//
Streamy.on('newPlayer', function (response) {
  if (
    response &&
    response.data
  ) newPlayerBuffer.push(response.data)
})

Streamy.on('gameStream', function (response) {
  if (
    response &&
    response.type &&
    response.data &&
    buffer.length < BUFFER_LIMIT
  ) buffer.push(response)
  if(buffer.length === BUFFER_LIMIT) console.log('buffer full')
})

//
// COMPONENT
//
var dynamicElementsById = {} // --> all the moving elements
var mainPlayerObj = {} // --> all the moving elements
var mainPlayer // main player
var group // ghosts group
var cursors;
var textElements = []
var elementsGroup;
const WIDTH = window.innerWidth
const HEIGHT = window.innerHeight

class GameCanvas extends React.Component {
  constructor (props) {
    super(props)
    this.create = this.create.bind(this)
    this.preload = this.preload.bind(this)
    this.update = this.update.bind(this)
    this.attachTextToSprite = this.attachTextToSprite.bind(this)
    this.renderCanvas = this.renderCanvas.bind(this)
    this.drawRect = this.drawRect.bind(this)
    this.addExplosion = this.addExplosion.bind(this)
  }
  preload () {
    const {game} = this.state
    game.stage.backgroundColor = '#007236'
    Object.keys(config).forEach((key) => {
      const el = config[key]
      if (el.name && el.img) game.load.image(el.name, el.img);
      console.log(el.img)
    })
    // game.load.image('tiles', 'assets/sprites/tilemap.png');
    game.load.spritesheet('tilemap', 'assets/sprites/tilemap.png', 101, 129)
    game.load.spritesheet('boom', 'assets/sprites/explosion_3.png', 128, 128)
  }

  create () {
    const {game} = this.state
    const {
      layers,
      ghosts,
      players,
      playerId
    } = this.props
    const graphics = game.add.graphics(0, 0)
    //  Modify the world and camera bounds
    game.world.setBounds(-50, -50, 2000, 2000)
    game.physics.startSystem(Phaser.Physics.ARCADE);
    game.stage.backgroundColor = '#2d2d2d';
    game.physics.arcade.sortDirection = Phaser.Physics.Arcade.TOP_BOTTOM;
    // CREATE GROUPS
    elementsGroup = game.add.physicsGroup(Phaser.Physics.ARCADE);
    // RENDER MAP LAYERS
    if (layers) {
      Object.keys(layers).forEach((layerName, index) => {
        const layer = layers[layerName]
        for (var y = 0; y < layer.matrix.length; y++) {
          for (var x = 0; x < layer.matrix[y].length; x++) {
            const element = layer.matrix[y][x]
            const refSize = layer.refSize
            if (element.val && element.val.type) {
              switch (element.val.type) {

                case 'block':
                  var block = elementsGroup.create(x * refSize, y * refSize, 'tilemap')
                  dynamicElementsById[element.id] = block
                  const block_width = block.body.width
                  const block_height = block.body.height
                  block.body.setSize(block_width, block_height / 2, 0, (block_height / 2) / 2) // width, height, offsetX, offsetY
                  block.frame = element.val.frame
                  block.scale.setTo(element.val.scale[0], element.val.scale[1])
                  block.body.immovable = true
                  break

                case 'ground':
                  var lineStyle = element.val.lineStyle
                  var fill = element.val.fill
                  var shape = {
                    x: x * refSize,
                    y: y * refSize,
                    width: refSize,
                    height: refSize
                  }
                  this.drawRect(graphics, shape, lineStyle, fill)
                default:

              }
            }
          }
        }
      })
    }

    if (ghosts) {
      Object.keys(ghosts).forEach((key) => {
        const ghost = ghosts[key]
        const newGhost = game.add.sprite(ghost.x, ghost.y, config.ghost.name)
        newGhost.scale.setTo(config.ghost.scale[0], config.ghost.scale[1]);
        dynamicElementsById[ghost.id] = newGhost
        this.attachTextToSprite(newGhost, ghost.name)
      })
    }

    if (players) {
      Object.keys(players).forEach((key) => {
        const player = players[key]
        if (player.id === playerId) { // If it's the main player
          mainPlayerObj = player
          mainPlayer = elementsGroup.create(player.x, player.y, config.player.name)
          // mainPlayer = game.add.sprite(player.x, player.y, config.player.name)
          mainPlayer.scale.setTo(config.player.scale[0], config.player.scale[1]);
          game.physics.arcade.enable(mainPlayer)
          // attach camera to main player
          game.camera.follow(mainPlayer, Phaser.Camera.FOLLOW_LOCKON, 0.1, 0.1);
          // add player name above
          this.attachTextToSprite(mainPlayer, player.name)
        } else { // Other players
          this.addPlayerToMap(player)
        }
      })
    }
    cursors = game.input.keyboard.createCursorKeys()
    elementsGroup.sort()
  }
  addExplosion (x, y) {
    const {game} = this.state
    var explosion = game.add.sprite(x, y, 'boom');
    explosion.anchor.set(0.5)
    //  Here we add a new animation called 'walk'
    //  Because we didn't give any other parameters it's going to make an animation from all available frames in the 'mummy' sprite sheet
    var boom = explosion.animations.add('boom');
    //  And this starts the animation playing by using its key ("walk")
    //  30 is the frame rate (30fps)
    //  true means it will loop when it finishes
    explosion.animations.play('boom', 10, false);
  }
  drawRect (graphics, shape, lineStyle, fill) {
    // draw a rectangle
    graphics.beginFill(fill[0], fill[1]);
    graphics.lineStyle(lineStyle[0], lineStyle[1], 0);
    graphics.drawRect(shape.x, shape.y, shape.width, shape.height);
    graphics.endFill();
  }
  attachTextToSprite (sprite, text) {
    const {game} = this.state
    var style = {
      font: "15px Arial",
      fill: "#ff0044",
      wordWrap: true,
      wordWrapWidth: sprite.width,
      align: "center"
    }
    let textElement = game.add.text(sprite.x, sprite.y - sprite.height, text, style)
    textElement.anchor.set(0.5)
    textElements.push({
      element: textElement,
      sprite: sprite
    })

  }
  addPlayerToMap (player) {
    var newPlayer = elementsGroup.create(player.x, player.y, config.player.name);
    newPlayer.scale.setTo(config.player.scale[0], config.player.scale[1]);
    dynamicElementsById[player.id] = newPlayer
    // add player name above
    this.attachTextToSprite(newPlayer, player.name)
  }
  removeElement (element, explosion) {
    if (explosion) this.addExplosion(element.x, element.y)
    sprite = dynamicElementsById[element.id]
    elementsGroup.remove(sprite)
    sprite.destroy()
  }
  update () {
    const {game} = this.state
    // SET COLLISIONS
    // game.physics.arcade.collide(elementsGroup, elementsGroup, this.collisionHandler, null, this);
    var blocks = elementsGroup.children.map((child) => {
      if (child.key === "tilemap") return child
    })
    game.physics.arcade.collide(mainPlayer, blocks, this.collisionHandler, null, this);
    // BUFFERS MANAGERS
    if (buffer.length > 0) {
      // const element =
      buffer.forEach((element) => {
        buffer.shift()
        const {type, data} = element
        switch (type) {
          // move element
          case 'mvt':
            if (
              data.id != mainPlayerObj.id &&
              dynamicElementsById[data.id]
            ) {
              dynamicElementsById[data.id].x = data.x
              dynamicElementsById[data.id].y = data.y
            }
            break;
          // remove element
          case 'rm':
            this.removeElement(data, true)
            break

        }

      })
    }
    if (newPlayerBuffer.length > 0) {
      console.log('new player !!!')
      const newPlayer = newPlayerBuffer.shift()
      this.addPlayerToMap(newPlayer)
    }
    // MAIN USER DEPLACEMENTS
    mainPlayer.body.velocity.x = 0;
    mainPlayer.body.velocity.y = 0;
    if (cursors.left.isDown)
    {
        mainPlayer.body.velocity.x = -200;
        this.updateMainPlayerObj()
    }
    else if (cursors.right.isDown)
    {
        mainPlayer.body.velocity.x = 200;
        this.updateMainPlayerObj()
    }

    if (cursors.up.isDown)
    {
        mainPlayer.body.velocity.y = -200;
        this.updateMainPlayerObj()
    }
    else if (cursors.down.isDown)
    {
        mainPlayer.body.velocity.y = 200;
        this.updateMainPlayerObj()
    }
    // update text elements positions
    textElements.forEach((textElement) => {
      textElement.element.x = Math.floor(textElement.sprite.x + textElement.sprite.width / 2)
      textElement.element.y = Math.floor(textElement.sprite.y - 10)
    })
    // re order Z depth
    elementsGroup.sort('y', Phaser.Group.SORT_ASCENDING);
  }
  updateMainPlayerObj () {
    mainPlayerObj.x = mainPlayer.x
    mainPlayerObj.y = mainPlayer.y
    // for client
    Streamy.broadcast('gameStream', {
      type: 'mvt',
      data: mainPlayerObj
    })
    // for server
    Streamy.emit('gameStream', { data: mainPlayerObj })
  }
  collisionHandler (player, block) {
    // here put the collision logic
  }

  renderCanvas () {
    const {game} = this.state
    // elementsGroup.hash.forEach((block) => {
    //     game.debug.body(block)
    // })
    // game.debug.cameraInfo(game.camera, 32, 32);
    // game.debug.text('Sprite z-depth: ' + mainPlayer.z, 10, 20);
  }

  // first time
  componentDidMount () {
    var game = new Phaser.Game(
      WIDTH,
      HEIGHT,
      Phaser.CANVAS,
      'phaser-example',
      {
        preload: this.preload,
        create: this.create,
        update: this.update,
        render : this.renderCanvas
      }
    )
    this.setState({game})
  }

  render () {
    return (
      <div id='phaser-example'></div>
    )
  }
}

//
// EXPORT
//
function mapStateToProps ({
  game: {
    layers,
    ghosts,
    players,
    playerId
  }
}) {
  return {
    layers,
    ghosts,
    players,
    playerId
  }
}

export default connect(
  mapStateToProps,
  {

  }
)(GameCanvas)
