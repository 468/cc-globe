'use strict';

const THREE = require('three');
const OrbitControls = require('three-orbit-controls')(THREE)
const PostProcessing = require('postprocessing');
const ThreeGlobe = require('three-globe');
const TWEEN = require('@tweenjs/tween.js');
const Tone = require('tone');
const io = require('socket.io-client');
const VueAnalytics = require('vue-analytics').default;
const StartAudioContext = require('startaudiocontext');

StartAudioContext(Tone.context, '#intro-cta');


(function() {

  const socket = io();

  const app = new Vue({
    el: '#app',
    data: {
      message: 'Hello Vue!',
      location: false,
      coords: false,
      introOpen: true,
      aboutOpen: false,
      ctaEnabled: false,
      isLoading: true,
      userColour: false,
      clientId: false,
      connections: {},
      introShown: false,
      GDPRpopup: true
    },
    mounted: function () {
      socket.on('connections', function(msg){
        createExistingPoints(msg);
      });

      socket.on('user', function(msg){
        createPointAtLocation(msg.coords, msg.colour, msg.user_id);
      });

      socket.on('disconnect', function(msg){
        removePointFromLocation(msg)
      })
    
      socket.on('light', function(msg){
        createBlobAtLocation(msg.coords, msg.colour);
      });
      this.isLoading = false;
    },
    methods: {
      toggleIntro: function () {
        this.closeGDPR();
        this.introShown = true;
        this.introOpen = !this.introOpen;
        if (!this.coords) {
          this.getLocation();
        }
      },
      toggleAbout: function() {
        this.aboutOpen = !this.aboutOpen;
      },
      timeoutCta: function() {
        this.ctaEnabled = false;
        let self = this;
        setTimeout(function () {
          self.ctaEnabled = true;
        }, 1500);
      },
      triggerCta: function() {
        if (this.coords) {
          this.timeoutCta();
          socket.emit('light', {coords: this.coords, colour: this.userColour});
        } else {
          if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(this.showPosition);
          } else {
            this.ctaEnabled = false;
          }
        }
      },
      pickUserColour: function() {
        this.userColour = '0x' + Math.floor(Math.random()*16777215).toString(16);
      },
      assignUser: function() {
        this.pickUserColour();
        socket.emit('user', {coords: this.coords, colour: this.userColour});
      },
      getLocation: function() {
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(this.showPosition);
        }
      },
      showPosition: function(position) {
          app.location = position;
      },
      acceptGDPR: function() {
        setupAnalytics();
        this.closeGDPR();
      },
      closeGDPR: function() {
        this.GDPRpopup = false;
      }
    },
    watch: {
      location: function (val) {
        if (val) {
          this.ctaEnabled = true;
          app.coords = Globe.getCoords(val.coords.latitude, val.coords.longitude, 0.015);
          this.assignUser();
        }
      }
    }
  })

  const setupAnalytics = function() {
    Vue.use(VueAnalytics, {
      id: 'UA-XXX-X',
      debug: {
        enabled: false, // default value
        trace: true, // default value
        sendHitTask: true // default value
      },
      set: [
        { field: 'anonymizeIp', value: true }
      ]
    });
    logPage();
  }

  const logPage = function() {
    app.$ga.page('/')
  }
  
  var reverb = new Tone.Reverb().toMaster();
  reverb.decay = 2

  var pitchShift = new Tone.PitchShift().toMaster();
  pitchShift.pitch = -4;

  var sound = new Tone.Player({
    url : "./assets/pluck_1.mp3",
    //loop : true,
  }).toMaster(); //toMaster basically just means to speakers I think

  sound.connect(pitchShift).connect(reverb);

  var min=-10; 
  var max=10;

  var getRandomNumber = function() {
    return Math.random() * (+max - +min) + +min;
  }

  function createBlobAtLocation(coords, colour) {
    if (Number.isFinite(coords.x) && Number.isFinite(coords.y) && Number.isFinite(coords.z)) {
      sound.stop();
      pitchShift.pitch = getRandomNumber();
      reverb.generate();
      sound.start();

      let light = new THREE.PointLight( parseInt(colour, 16), 100, 0, 3 );
      light.position.set( coords.x, coords.y, coords.z );
      scene.add( light );

      let tween = new TWEEN.Tween(light) // Create a new tween that modifies 'coords'.
        .to({intensity:0}, 1500) // Move to (300, 200) in 1 second.
        .easing(TWEEN.Easing.Quadratic.Out) // Use an easing function to make the animation smooth.
        .onComplete(function(){
          scene.remove(light)
        });
      tween.start(); // Start the tween immediately.
    }
  }

  function createStars() {
    var vertices = [];
    for ( var i = 0; i < 1000; i ++ ) {
    
      var x = THREE.MathUtils.randFloatSpread( 2000 );
      var y = THREE.MathUtils.randFloatSpread( 2000 );
      var z = THREE.MathUtils.randFloatSpread( 2000 );
    
      vertices.push( x, y, z );
    
    }
    
    var geometry = new THREE.BufferGeometry();
    geometry.setAttribute( 'position', new THREE.Float32BufferAttribute( vertices, 3 ) );
    
    var material = new THREE.PointsMaterial( { color: 0x888888 } );
    //material.depthTest = false;
    var points = new THREE.Points( geometry, material );
    
    scene.add( points );
  }

  const dots = {}

  function createPointAtLocation(coords, colour, id) {
    let dotGeometry = new THREE.BufferGeometry();
    let dotMaterial = new THREE.PointsMaterial( { size: 2, color: parseInt(colour, 16) } );
    dotGeometry.setAttribute( 'position', new THREE.Float32BufferAttribute([coords.x, coords.y, coords.z], 3 ) );
    let dot = new THREE.Points( dotGeometry, dotMaterial );
    scene.add( dot );
    dots[id] = { 'dot': dot}
    console.log(dots);
  }

  function removePointFromLocation(id) {
    if (dots[id]) {
      scene.remove( dots[id].dot);
      delete dots[id];
    }
  }

  function createExistingPoints(connections) {
    for (const property in connections) {
      createPointAtLocation( connections[property].coords, connections[property].colour, connections[property].user_id);
    }
  }

  const Globe = new ThreeGlobe()
    //.globeImageUrl('//unpkg.com/three-globe/example/img/earth-blue-marble.jpg')
    //.globeImageUrl('//unpkg.com/three-globe@2.6.9/example/img/earth-dark.jpg')
    .globeImageUrl('./assets/earth-lighter-blue.jpg')
    //.bumpImageUrl('//unpkg.com/three-globe/example/img/earth-topology.png')
    .pointAltitude('size')
    .pointColor('color');
    //.pointsData(gData)
  
    const renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(1);
    document.querySelector('.three-container').appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.add(Globe);
    scene.add(new THREE.AmbientLight(0xffffff));
    scene.add(new THREE.DirectionalLight(0xffffff, 0.6));

      // Setup camera
    const camera = new THREE.PerspectiveCamera();
    camera.aspect = window.innerWidth/window.innerHeight;
    camera.updateProjectionMatrix();

    if (window.innerWidth < 600) {
      camera.position.z = 650;
    } else {
      camera.position.z = 380;
    }

    // Add camera controls
    const orbitControls = new OrbitControls( camera, renderer.domElement );
    orbitControls.autoRotate = true;
    orbitControls.enableZoom = false;   

    const composer = new PostProcessing.EffectComposer( renderer );
    composer.addPass( new PostProcessing.RenderPass( scene, camera ) );
    composer.addPass(new PostProcessing.EffectPass(camera, new PostProcessing.BloomEffect()));

    createStars();
    
    // Kick-off renderer
    (function animate() { // IIFE
      orbitControls.update();
      TWEEN.update();
      composer.render();
      requestAnimationFrame(animate);
    })();
    
})();
