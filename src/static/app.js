document.addEventListener('DOMContentLoaded', () => {
  const activitiesList = document.getElementById('activities-list');
  const activitySelect = document.getElementById('activity');
  const signupForm = document.getElementById('signup-form');
  const messageDiv = document.getElementById('message');

  // Store references for quick UI updates: { "Activity Name": { card, list, heading, max } }
  const activityMap = {}; 

  function showMessage(text, type = 'info') {
    messageDiv.textContent = text;
    messageDiv.className = `message ${type}`;
    messageDiv.classList.remove('hidden');
    setTimeout(() => messageDiv.classList.add('hidden'), 4000);
  }

  function updateParticipantsHeading(el, count, max) {
    el.textContent = `Participants (${count}/${max})`;
  }

  // Create a participant list item with a delete button
  function createParticipantListItem(email, activityName, entry) {
    const li = document.createElement('li');

    const span = document.createElement('span');
    span.textContent = email;

    const btn = document.createElement('button');
    btn.className = 'delete-btn';
    btn.setAttribute('aria-label', `Unregister ${email}`);
    btn.textContent = '✖';

    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!confirm(`Unregister ${email} from ${activityName}?`)) return;
      try {
        const res = await fetch(`/activities/${encodeURIComponent(activityName)}/participants/${encodeURIComponent(email)}`, { method: 'DELETE' });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          const detail = data.detail || data.message || 'Failed to unregister';
          showMessage(detail, 'error');
          return;
        }
        // Refresh from server to keep UI in sync
        await refreshActivity(activityName);
        showMessage(data.message || `${email} unregistered`, 'success');
      } catch (err) {
        showMessage('Failed to unregister. Please try again.', 'error');
        console.error(err);
      }
    });

    li.appendChild(span);
    li.appendChild(btn);
    return li;
  }

  // Refresh participants for a specific activity from the server
  async function refreshActivity(activityName) {
    try {
      const res = await fetch('/activities');
      const data = await res.json();
      const activity = data[activityName];
      if (!activity) return;
      const entry = activityMap[activityName];
      if (!entry) return;

      // Clear current list
      entry.list.innerHTML = '';

      if (!activity.participants || activity.participants.length === 0) {
        const li = document.createElement('li');
        li.className = 'participant-empty';
        li.textContent = 'No participants yet';
        entry.list.appendChild(li);
      } else {
        activity.participants.forEach((email) => {
          const li = createParticipantListItem(email, activityName, entry);
          entry.list.appendChild(li);
        });
      }

      updateParticipantsHeading(entry.heading, activity.participants.length, entry.max);
    } catch (err) {
      console.error('Failed to refresh activity', err);
    }
  }

  async function loadActivities() {
    activitiesList.innerHTML = '<p>Loading activities...</p>';
    try {
      const res = await fetch('/activities');
      const data = await res.json();

      activitiesList.innerHTML = '';
      activitySelect.innerHTML = '<option value="">-- Select an activity --</option>';

      Object.keys(data).forEach((name) => {
        const activity = data[name];

        // Card
        const card = document.createElement('div');
        card.className = 'activity-card';

        const h4 = document.createElement('h4');
        h4.textContent = name;

        const pDesc = document.createElement('p');
        pDesc.textContent = activity.description;

        const pSchedule = document.createElement('p');
        pSchedule.textContent = `Schedule: ${activity.schedule}`;

        const pMax = document.createElement('p');
        pMax.textContent = `Max participants: ${activity.max_participants}`;

        // Participants section
        const participantsDiv = document.createElement('div');
        participantsDiv.className = 'participants';

        const h5 = document.createElement('h5');
        updateParticipantsHeading(h5, activity.participants.length, activity.max_participants);

        const ul = document.createElement('ul');
        ul.className = 'participants-list';

        if (activity.participants.length === 0) {
          const li = document.createElement('li');
          li.className = 'participant-empty';
          li.textContent = 'No participants yet';
          ul.appendChild(li);
        } else {
          activity.participants.forEach((email) => {
            const li = createParticipantListItem(email, name, { list: ul, heading: h5, max: activity.max_participants });
            ul.appendChild(li);
          });
        }

        participantsDiv.appendChild(h5);
        participantsDiv.appendChild(ul);

        card.appendChild(h4);
        card.appendChild(pDesc);
        card.appendChild(pSchedule);
        card.appendChild(pMax);
        card.appendChild(participantsDiv);

        activitiesList.appendChild(card);

        // Add option to select
        const opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name;
        activitySelect.appendChild(opt);

        // Save references for later updates
        activityMap[name] = { card, list: ul, heading: h5, max: activity.max_participants };
      });
    } catch (err) {
      activitiesList.innerHTML = '<p class="error">Failed to load activities.</p>';
      console.error(err);
    }
  }

  signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value.trim();
    const activity = activitySelect.value;

    if (!email || !activity) {
      showMessage('Please enter your email and select an activity.', 'error');
      return;
    }

    // Client-side capacity check
    const entry = activityMap[activity];
    if (entry) {
      const currentParticipants = entry.list.querySelectorAll('li:not(.participant-empty)').length;
      if (currentParticipants >= entry.max) {
        showMessage('This activity is already full.', 'error');
        return;
      }
    }

    // Disable submit while processing
    const submitButton = signupForm.querySelector('button[type="submit"]');
    submitButton.disabled = true;

    try {
      const url = `/activities/${encodeURIComponent(activity)}/signup?email=${encodeURIComponent(email)}`;
      const res = await fetch(url, { method: 'POST' });
      const resJson = await res.json().catch(() => ({}));

      if (!res.ok) {
        const detail = resJson.detail || resJson.message || 'Sign up failed';
        showMessage(detail, 'error');
        submitButton.disabled = false;
        return;
      }

      showMessage(resJson.message || 'Signed up successfully!', 'success');

      // Update UI from server to ensure consistent state
      if (entry) {
        await refreshActivity(activity);
      }

      signupForm.reset();
    } catch (err) {
      showMessage('Failed to sign up. Please try again.', 'error');
      console.error(err);
    } finally {
      submitButton.disabled = false;
    }
  });

  // Initial load
  loadActivities();
});
