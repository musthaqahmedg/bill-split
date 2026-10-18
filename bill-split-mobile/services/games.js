// 🎮 Party games content. Clean, fun, and never about drinking more.

export const WHEEL_REASONS = [
  'picks the next song 🎵',
  'orders the food 🍕',
  'is the DJ tonight 🎧',
  'gives a toast 🥂',
  'tells an embarrassing story 😳',
  'does a 10-second dance 💃',
  'picks the movie 🎬',
  'takes the group selfie 🤳',
];

export const NEVER = [
  'Never have I ever sent a text to the wrong person',
  'Never have I ever fallen asleep in a movie theatre',
  'Never have I ever pretended to know a song',
  'Never have I ever stalked an ex on Instagram',
  'Never have I ever lied about being "on the way"',
  'Never have I ever laughed at a joke I didn’t get',
  'Never have I ever forgotten a friend’s birthday',
  'Never have I ever cried at a movie',
  'Never have I ever eaten food that fell on the floor',
  'Never have I ever ghosted someone',
  'Never have I ever sung in the shower… loudly',
  'Never have I ever googled myself',
  'Never have I ever said "I’m fine" when I wasn’t',
  'Never have I ever skipped a class or work to sleep',
  'Never have I ever replied "lol" without laughing',
  'Never have I ever had a crush on a teacher',
  'Never have I ever got lost with Google Maps on',
  'Never have I ever waved back at someone who wasn’t waving at me',
  'Never have I ever binge-watched a whole series in one day',
  'Never have I ever pretended to be busy to avoid a call',
  'Never have I ever walked into a glass door',
  'Never have I ever re-gifted a present',
  'Never have I ever fake-laughed on a video call',
  'Never have I ever eaten a whole pizza alone',
  'Never have I ever forgotten someone’s name right after meeting them',
];

export const TRUTHS = [
  'What’s the most embarrassing thing on your phone right now?',
  'Who in this group would you call at 3 AM?',
  'What’s your biggest red flag?',
  'What’s the last lie you told?',
  'Which song do you secretly love?',
  'What’s your worst cooking disaster?',
  'Who was your first crush?',
  'What’s the weirdest thing you’ve searched online?',
  'What’s one thing you’d change about this group?',
  'What’s your most used emoji and why?',
  'Show your last 3 photos in the gallery 📸',
  'What’s the most childish thing you still do?',
  'What’s a habit you’re secretly proud of?',
  'Who here would survive a zombie apocalypse the longest?',
  'What’s your guilty-pleasure movie?',
];

export const DARES = [
  'Do your best impression of someone in the group 🎭',
  'Talk in an accent for the next 2 rounds',
  'Let the group post a story from your phone (nothing mean!) 📱',
  'Do 10 push-ups right now 💪',
  'Sing the chorus of the last song you played 🎤',
  'Show the group your best dance move 🕺',
  'Speak only in questions until your next turn',
  'Call a friend and sing them happy birthday 🎂',
  'Do a dramatic slow-motion walk across the room',
  'Let someone draw on your hand with a pen ✍️',
  'Text your mom "I love you" ❤️',
  'Act like a cat for 30 seconds 🐱',
  'Tell a joke. If nobody laughs, tell another 😂',
  'Make a 10-second ad for the snacks on the table 🍿',
  'Do the robot dance for 15 seconds 🤖',
];

export const CHARADES = {
  '🎬 Movies': ['Premam', 'Drishyam', 'Bangalore Days', 'Manjummel Boys', 'Aavesham', 'Kumbalangi Nights', 'Baahubali', 'RRR', '3 Idiots', 'Dangal', 'Titanic', 'Avengers', 'Frozen', 'The Lion King', 'Spider-Man', 'Jurassic Park', 'KGF', 'Pushpa', 'Sholay', 'Harry Potter'],
  '🤸 Actions': ['Brushing teeth', 'Riding a bike', 'Taking a selfie', 'Swimming', 'Cooking dosa', 'Playing cricket', 'Driving in traffic', 'Dancing at a wedding', 'Fishing', 'Climbing a tree', 'Ordering at a restaurant', 'Walking a dog', 'Typing on a laptop', 'Getting caught in rain', 'Opening a gift'],
  '🍛 Food': ['Biryani', 'Porotta', 'Puttu', 'Pizza', 'Ice cream', 'Momos', 'Samosa', 'Fish curry', 'Payasam', 'Noodles', 'Shawarma', 'Idli', 'Burger', 'Pani puri', 'Chocolate'],
  '🐘 Animals': ['Elephant', 'Monkey', 'Penguin', 'Kangaroo', 'Snake', 'Giraffe', 'Peacock', 'Crocodile', 'Rabbit', 'Lion', 'Frog', 'Octopus'],
};

export const pick = (list, not) => {
  if (list.length < 2) return list[0];
  let x;
  do x = list[Math.floor(Math.random() * list.length)];
  while (x === not);
  return x;
};
