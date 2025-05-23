
  const chat = document.getElementById("chat");
  let angle = 0;
  let direction = 1;

  function tanguer() {
    angle += direction * 0.5; // vitesse de tangage

    if (angle > 10 || angle < -10) {
      direction *= -1; // inverse la direction
    }

    chat.style.transform = `rotate(${angle}deg)`;
    requestAnimationFrame(tanguer);
  }

  tanguer(); // lancer l'animation