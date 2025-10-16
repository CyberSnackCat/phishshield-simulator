(function(){
  const params = new URLSearchParams(location.search);
  const name = params.get('name')||'PLAYER';
  const score = params.get('score')||'0';
  const rounds = params.get('rounds')||'0';
  const mistakes = params.get('mistakes')||'0';
  document.getElementById('cert-name').textContent = name;
  document.getElementById('cert-score').textContent = score;
  document.getElementById('cert-rounds').textContent = rounds;
  document.getElementById('cert-mistakes').textContent = mistakes;
  const d = new Date();
  document.getElementById('cert-date').textContent = d.toLocaleDateString() + ' • ' + d.toLocaleTimeString();
})();
