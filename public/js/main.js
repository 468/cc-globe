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

(function() {

  const socket = io.connect('https://cc-globe.herokuapp.com');

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
      GDPRpopup: true,
      sounds: [ "bass", "hat1", "low_hit", "pad_1", "pad_airy_1", "pad_airy_2", "pluck", "pluck_2", "rim", "shaker" ],
      instrument: false,
      pitch: 0,
      pitchArrayOne: [0, 2, 4, 7, 9, 10],
      pitchArrayTwo: [-10, -9, -6, 0, 4, 8],
      scale: false,
      pitchEnabled: false,
      isMobileView: false,
      menuDropdownToggle: false
    },
    beforeMount: function() {
      if (localStorage.getItem("gdprSeen")) {
        this.GDPRpopup = false;
      }
    },
    mounted: function () {

      if (window.innerWidth < 768) {
        this.isMobileView = true;
      }

      window.addEventListener('resize', () => {
        if (window.innerWidth < 768) {
          this.isMobileView = true;
        } else {
          this.isMobileView = false;
        }
      })


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
        createBlobAtLocation(msg.coords, msg.colour, msg.instrument, msg.pitch);
      });
      this.isLoading = false;
      setupAnalytics();
    },
    methods: {
      toggleIntro: function () {
        this.closeGDPR();
        this.introShown = true;
        Tone.context.resume();
        this.introOpen = !this.introOpen;
        this.aboutOpen ? this.aboutOpen = false : null;
        if (!this.coords) {
          this.getLocation();
        }
      },
      toggleDropdown: function() {
        this.menuDropdownToggle = !this.menuDropdownToggle;
      },
      toggleAbout: function() {
        this.aboutOpen = !this.aboutOpen;
        this.introOpen && this.introShown ? this.introOpen = false : null;
      },
      timeoutCta: function() {
        this.ctaEnabled = false;
        let self = this;
        setTimeout(function () {
          self.ctaEnabled = true;
        }, 1500);
      },
      goHome: function() {
        this.aboutOpen = false;
        this.introShown ? this.introOpen = false : null;

      },
      triggerCta: function() {
        if (this.coords) {
          this.timeoutCta();
          //this.setPitch();
          socket.emit('light', {coords: this.coords, colour: this.userColour, instrument: this.userInstrument, pitch: this.pitch });
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
      setScale: function() {
        if (this.userInstrument === 'bass' || this.userInstrument === 'low_hit') {
          this.scale = this.pitchArrayOne;
          this.pitchEnabled = true;
        } else if (this.userInstrument === 'pluck' || this.userInstrument === 'pad_airy_1' || this.userInstrument === 'pad_airy_2' ) {
          this.scale = this.pitchArrayTwo;
          this.pitchEnabled = true;
        } else {
          this.scale = this.pitchArrayOne;
        }
      },
      pickUserInstrument: function() {
        this.userInstrument = this.sounds[Math.floor(Math.random() * this.sounds.length)];
        this.setScale();
      },
      setPitch: function() {
        if (this.userInstrument === 'bass' || this.userInstrument === 'low_hit') {
          this.pitch = this.pitchArrayOne[Math.floor(Math.random() * this.pitchArrayOne.length)];
        } else if (this.userInstrument === 'pluck' || this.userInstrument === 'pad_airy_1' || this.userInstrument === 'pad_airy_2' ) {
          this.pitch = this.pitchArrayTwo[Math.floor(Math.random() * this.pitchArrayTwo.length)];
        } else {
          this.pitch = 0;
        }
      },
      assignUser: function() {
        this.pickUserColour();
        this.pickUserInstrument();
        socket.emit('user', {coords: this.coords, colour: this.userColour});
      },
      getLocation: function() {
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(this.showPosition);
        }
      },
      showPosition: function(position) {
          let updatedPosition = { coords: {latitude: 0, longitude: 0}};
          updatedPosition['coords']['latitude'] = position.coords.latitude.toFixed(2);
          updatedPosition['coords']['longitude'] = position.coords.longitude.toFixed(2);
          app.location = updatedPosition;
      },
      acceptGDPR: function() {
        this.closeGDPR();
      },
      closeGDPR: function() {
        localStorage.setItem("gdprSeen", true);
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
      id: 'UA-162427153-2',
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

  
  const bgSound = "background";
  const sounds = [ "bass", "hat1", "low_hit", "pad_1", "pad_airy_1", "pad_airy_2", "pluck", "pluck_2", "rim", "shaker" ]
  const allSounds = {};
  
  const reverb = new Tone.Reverb().toMaster();
  reverb.decay = 2

  const pitchShift = new Tone.PitchShift().toMaster();
  const pitchShiftTwo = new Tone.PitchShift().toMaster();


  let soundBackground = new Tone.Player({
    url : `./sounds/${bgSound}.mp3`,
    loop : true,
    autostart: true
  }).toMaster(); 

  soundBackground.volume.value = -6;

  for (let i = 0; i< sounds.length; i++) {
    allSounds[`${sounds[i]}`] = new Tone.Player({
      url : `./sounds/${sounds[i]}.mp3`,
    }).toMaster();

    allSounds[`${sounds[i]}`].connect(reverb);
    allSounds[`${sounds[i]}`].volume.value = -5;

    if (sounds[i] === 'bass' || sounds[i] === 'low_hit') {
      allSounds[`${sounds[i]}`].connect(pitchShift);

    } else if (sounds[i] === 'pluck' || sounds[i] === 'pad_airy_1' || sounds[i] === 'pad_airy_2') {
      allSounds[`${sounds[i]}`].connect(pitchShiftTwo);
    }
  }

  const getRandomFromArray = function(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function createBlobAtLocation(coords, colour, sound, pitch) {
    if (Number.isFinite(coords.x) && Number.isFinite(coords.y) && Number.isFinite(coords.z)) {
      allSounds[sound].stop();
      if(sound === 'bass' || sound === 'low_hit') {
        pitchShift.pitch = pitch;
      } else if (sound === 'pluck' || sound === 'pad_airy_1' || sound === 'pad_airy_2' ) {
        pitchShiftTwo.pitch = pitch;
      }
      reverb.generate();
      allSounds[sound].start();

      let light = new THREE.PointLight( parseInt(colour, 16), 150, 0, 5);
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
    .pointColor('color')

    Globe['children'][0]['children'][0]['children'][0].material.shininess = 0;

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
      camera.position.z = 500;
    } else {
      camera.position.z = 375;
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
